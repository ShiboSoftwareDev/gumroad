# frozen_string_literal: true

class Api::V2::PayoutsController < Api::V2::BaseController
  before_action -> { doorkeeper_authorize!(:view_payouts) }

  RESULTS_PER_PAGE = 10

  def index
    begin
      end_date = Date.strptime(params[:before], "%Y-%m-%d") if params[:before]
    rescue ArgumentError
      return error_400("Invalid date format provided in field 'before'. Dates must be in the format YYYY-MM-DD.")
    end

    begin
      start_date = Date.strptime(params[:after], "%Y-%m-%d") if params[:after]
    rescue ArgumentError
      return error_400("Invalid date format provided in field 'after'. Dates must be in the format YYYY-MM-DD.")
    end

    if params[:page_key].present?
      begin
        last_payout_created_at, last_payout_id = decode_page_key(params[:page_key])
      rescue ArgumentError
        return error_400("Invalid page_key.")
      end
      where_page_data = ["created_at <= ? and id < ?", last_payout_created_at, last_payout_id]
    end

    payouts = filter_payouts(start_date: start_date, end_date: end_date)
    payouts = payouts.where(where_page_data) if where_page_data
    payouts = payouts.limit(RESULTS_PER_PAGE + 1).to_a

    has_next_page = payouts.size > RESULTS_PER_PAGE
    payouts = payouts.first(RESULTS_PER_PAGE)
    additional_response = has_next_page ? pagination_info(payouts.last) : {}

    success_with_object(:payouts, payouts.as_json(version: 2), additional_response)
  end

  def show
    payout = current_resource_owner.payments.find_by_external_id(params[:id])
    payout ? success_with_payout(payout.as_json(version: 2)) : error_with_payout
  end

  private
    def success_with_payout(payout = nil)
      success_with_object(:payout, payout)
    end

    def error_with_payout(payout = nil)
      error_with_object(:payout, payout)
    end

    def filter_payouts(start_date: nil, end_date: nil)
      payouts = current_resource_owner.payments.displayable
      payouts = payouts.where("created_at >= ?", start_date) if start_date
      payouts = payouts.where("created_at < ?", end_date) if end_date
      payouts.order(created_at: :desc, id: :desc)
    end
end
