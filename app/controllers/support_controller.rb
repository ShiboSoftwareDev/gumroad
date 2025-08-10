# frozen_string_literal: true

class SupportController < Sellers::BaseController
  include HelperWidget

  def index
    authorize :support

    timestamp = (Time.current.to_f * 1000).to_i
    session = {
      email: current_seller.email,
      emailHash: helper_widget_email_hmac(timestamp),
      timestamp: timestamp,
      customerMetadata: helper_customer_metadata,
    }

    @props = {
      host: helper_widget_host,
      session: session,
    }
  end
end
