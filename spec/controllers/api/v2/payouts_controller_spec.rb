# frozen_string_literal: true

require "spec_helper"
require "shared_examples/authorized_oauth_v1_api_method"

describe Api::V2::PayoutsController do
      before do
    # Configure cipher keys for external ID generation - use and_call_original to allow other GlobalConfig calls
    allow(GlobalConfig).to receive(:get).and_call_original
    allow(GlobalConfig).to receive(:get).with("OBFUSCATE_IDS_CIPHER_KEY").and_return("test_cipher_key_32_chars_long123")
    allow(GlobalConfig).to receive(:get).with("OBFUSCATE_IDS_NUMERIC_CIPHER_KEY").and_return("123456789")

    # Reload the ObfuscateIds module constants with the new configuration
    ObfuscateIds.send(:remove_const, :CIPHER_KEY) if ObfuscateIds.const_defined?(:CIPHER_KEY)
    ObfuscateIds.send(:remove_const, :NUMERIC_CIPHER_KEY) if ObfuscateIds.const_defined?(:NUMERIC_CIPHER_KEY)
    ObfuscateIds.const_set(:CIPHER_KEY, GlobalConfig.get("OBFUSCATE_IDS_CIPHER_KEY"))
    ObfuscateIds.const_set(:NUMERIC_CIPHER_KEY, GlobalConfig.get("OBFUSCATE_IDS_NUMERIC_CIPHER_KEY").to_i)

    @seller = create(:user)
    @other_seller = create(:user)
    @app = create(:oauth_application, owner: create(:user))
    # Ensure payments are created after the displayable date and with recent timestamps
    @payout = create(:payment_completed, user: @seller, amount_cents: 150_00, currency: "USD", created_at: 1.day.ago)
    @payout_by_other_seller = create(:payment_completed, user: @other_seller, amount_cents: 100_00, currency: "USD", created_at: 1.day.ago)
  end

  after do
    # Restore original constants to avoid affecting other tests
    ObfuscateIds.send(:remove_const, :CIPHER_KEY) if ObfuscateIds.const_defined?(:CIPHER_KEY)
    ObfuscateIds.send(:remove_const, :NUMERIC_CIPHER_KEY) if ObfuscateIds.const_defined?(:NUMERIC_CIPHER_KEY)
    ObfuscateIds.const_set(:CIPHER_KEY, GlobalConfig.get("OBFUSCATE_IDS_CIPHER_KEY"))
    ObfuscateIds.const_set(:NUMERIC_CIPHER_KEY, GlobalConfig.get("OBFUSCATE_IDS_NUMERIC_CIPHER_KEY").to_i)
  end

  describe "GET 'index'" do
    before do
      @params = {}
    end

    describe "when logged in with sales scope" do
      before do
        @token = create("doorkeeper/access_token", application: @app, resource_owner_id: @seller.id, scopes: "view_sales")
        @params.merge!(format: :json, access_token: @token.token)
      end

      it "returns the right response" do
        travel_to(Time.current + 5.minutes) do
          get :index, params: @params
          payouts_json = [@payout.as_json(version: 2)].map(&:as_json)

          expect(response.parsed_body.keys).to match_array ["success", "payouts"]
          expect(response.parsed_body["success"]).to eq true
          expect(response.parsed_body["payouts"]).to match_array payouts_json
        end
      end

      it "returns a link to the next page if there are more than 10 payouts" do
        per_page = Api::V2::PayoutsController::RESULTS_PER_PAGE
        create_list(:payment_completed, per_page, user: @seller, created_at: 2.days.ago)
        expected_payouts = @seller.payments.displayable.order(created_at: :desc, id: :desc).to_a

        travel_to(Time.current + 5.minutes) do
          get :index, params: @params
          expected_page_key = "#{expected_payouts[per_page - 1].created_at.to_fs(:usec)}-#{ObfuscateIds.encrypt_numeric(expected_payouts[per_page - 1].id)}"
          expect(response.parsed_body).to include({
            success: true,
            payouts: expected_payouts.first(per_page).as_json(version: 2),
            next_page_url: "/v2/payouts.json?page_key=#{expected_page_key}",
            next_page_key: expected_page_key,
          }.as_json)
          total_found = response.parsed_body["payouts"].size

          @params[:page_key] = response.parsed_body["next_page_key"]
          get :index, params: @params
          expect(response.parsed_body).to eq({
            success: true,
            payouts: expected_payouts[per_page..].as_json(version: 2)
          }.as_json)
          total_found += response.parsed_body["payouts"].size
          expect(total_found).to eq(expected_payouts.size)
        end
      end

      it "returns the correct link to the next pages from second page onwards" do
        per_page = Api::V2::PayoutsController::RESULTS_PER_PAGE
        create_list(:payment_completed, (per_page * 3), user: @seller, created_at: 3.days.ago)
        expected_payouts = @seller.payments.displayable.order(created_at: :desc, id: :desc).to_a

        @params[:page_key] = "#{expected_payouts[per_page].created_at.to_fs(:usec)}-#{ObfuscateIds.encrypt_numeric(expected_payouts[per_page].id)}"
        get :index, params: @params

        expected_page_key = "#{expected_payouts[per_page * 2].created_at.to_fs(:usec)}-#{ObfuscateIds.encrypt_numeric(expected_payouts[per_page * 2].id)}"
        expected_next_page_url = "/v2/payouts.json?page_key=#{expected_page_key}"

        expect(response.parsed_body["next_page_url"]).to eq expected_next_page_url
      end

      it "does not return payouts outside of date range" do
        @params.merge!(after: 5.days.ago.strftime("%Y-%m-%d"), before: 2.days.ago.strftime("%Y-%m-%d"))
        create(:payment_completed, user: @seller, created_at: 7.days.ago)
        in_range_payout = create(:payment_completed, user: @seller, created_at: 3.days.ago)
        get :index, params: @params
        expect(response.parsed_body).to eq({
          success: true,
          payouts: [in_range_payout.as_json(version: 2)]
        }.as_json)
      end

      it "returns a 400 error if after date format is incorrect" do
        @params.merge!(after: "394293")
        get :index, params: @params
        expect(response.code).to eq "400"
        expect(response.parsed_body).to eq({
          status: 400,
          error: "Invalid date format provided in field 'after'. Dates must be in the format YYYY-MM-DD."
        }.as_json)
      end

      it "returns a 400 error if before date format is incorrect" do
        @params.merge!(before: "invalid-date")
        get :index, params: @params
        expect(response.code).to eq "400"
        expect(response.parsed_body).to eq({
          status: 400,
          error: "Invalid date format provided in field 'before'. Dates must be in the format YYYY-MM-DD."
        }.as_json)
      end

      it "returns a 400 error if page_key is invalid" do
        @params.merge!(page_key: "invalid-page-key")
        get :index, params: @params
        expect(response.code).to eq "400"
        expect(response.parsed_body).to eq({
          status: 400,
          error: "Invalid page_key."
        }.as_json)
      end

      it "returns empty result set when no payouts exist in date range" do
        @params.merge!(after: 1.month.from_now.strftime("%Y-%m-%d"), before: 2.months.from_now.strftime("%Y-%m-%d"))
        get :index, params: @params
        expect(response.parsed_body).to eq({
          success: true,
          payouts: []
        }.as_json)
      end

            it "only returns payouts for the current seller" do
        create(:payment_completed, user: @other_seller, created_at: 1.day.ago)
        seller_payout = create(:payment_completed, user: @seller, created_at: 2.hours.ago)

        get :index, params: @params

        payout_user_ids = response.parsed_body["payouts"].map { |p| Payment.find_by_external_id(p["id"]).user_id }
        expect(payout_user_ids).to all(eq(@seller.id))
        expect(response.parsed_body["payouts"].size).to eq 2 # @payout + seller_payout
      end

      it "filters by date correctly when both before and after are provided" do
        old_payout = create(:payment_completed, user: @seller, created_at: 10.days.ago)
        recent_payout = create(:payment_completed, user: @seller, created_at: 1.day.from_now)
        middle_payout = create(:payment_completed, user: @seller, created_at: 3.days.ago)

        @params.merge!(after: 5.days.ago.strftime("%Y-%m-%d"), before: 2.days.ago.strftime("%Y-%m-%d"))
        get :index, params: @params

        payout_ids = response.parsed_body["payouts"].map { |p| p["id"] }
        expect(payout_ids).to include(middle_payout.external_id)
        expect(payout_ids).not_to include(old_payout.external_id)
        expect(payout_ids).not_to include(recent_payout.external_id)
      end

      it "returns payouts in descending order by creation date" do
        oldest_payout = create(:payment_completed, user: @seller, created_at: 5.days.ago)
        newest_payout = create(:payment_completed, user: @seller, created_at: 1.day.ago)

        get :index, params: @params

        payout_ids = response.parsed_body["payouts"].map { |p| p["id"] }
        newest_index = payout_ids.index(newest_payout.external_id)
        oldest_index = payout_ids.index(oldest_payout.external_id)

        expect(newest_index).to be < oldest_index
      end
    end

    describe "when logged in with public scope" do
      before do
        @token = create("doorkeeper/access_token", application: @app, resource_owner_id: @seller.id, scopes: "view_public")
        @params.merge!(format: :json, access_token: @token.token)
      end

      it "the response is 403 forbidden for incorrect scope" do
        get :index, params: @params
        expect(response.code).to eq "403"
      end
    end

    describe "when not logged in" do
      before do
        @params.merge!(format: :json)
      end

      it "the response is 401 unauthorized" do
        get :index, params: @params
        expect(response.code).to eq "401"
      end
    end
  end

  describe "GET 'show'" do
    before do
      @params = { id: @payout.external_id }
    end

    describe "when logged in with sales scope" do
      before do
        @token = create("doorkeeper/access_token", application: @app, resource_owner_id: @seller.id, scopes: "view_sales")
        @params.merge!(access_token: @token.token)
      end

      it "returns a payout that belongs to the seller" do
        get :show, params: @params
        expect(response.parsed_body).to eq({
          success: true,
          payout: @payout.as_json(version: 2)
        }.as_json)
      end

      it "does not return a payout that does not belong to the seller" do
        @params.merge!(id: @payout_by_other_seller.external_id)
        get :show, params: @params
        expect(response.parsed_body).to eq({
          success: false,
          message: "The payout was not found."
        }.as_json)
      end

      it "returns 404 for non-existent payout" do
        @params.merge!(id: "non-existent-id")
        get :show, params: @params
        expect(response.parsed_body).to eq({
          success: false,
          message: "The payout was not found."
        }.as_json)
      end

      it "returns correct payout data structure" do
        get :show, params: @params
        payout_data = response.parsed_body["payout"]

        expect(payout_data).to include(
          "id" => @payout.external_id,
          "amount" => (@payout.amount_cents / 100.0).to_s,
          "currency" => @payout.currency,
          "status" => @payout.state,
          "payment_processor" => @payout.processor
        )
        expect(payout_data["created_at"]).to be_present
      end
    end

    describe "when logged in with public scope" do
      before do
        @token = create("doorkeeper/access_token", application: @app, resource_owner_id: @seller.id, scopes: "view_public")
        @params.merge!(format: :json, access_token: @token.token)
      end

      it "the response is 403 forbidden for incorrect scope" do
        get :show, params: @params
        expect(response.code).to eq "403"
      end
    end

    describe "when not logged in" do
      before do
        @params.merge!(format: :json)
      end

      it "the response is 401 unauthorized" do
        get :show, params: @params
        expect(response.code).to eq "401"
      end
    end
  end
end
