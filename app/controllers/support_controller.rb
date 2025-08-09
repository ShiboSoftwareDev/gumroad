class SupportController < Sellers::BaseController
  include HelperWidget

  def index
    authorize :support

    timestamp = (Time.current.to_f * 1000).to_i
    session = {
      email: current_seller.email,
      emailHash: helper_widget_email_hmac(timestamp),
      timestamp: timestamp,
    }

    @props = {
      host: helper_widget_host,
      session: session,
    }
  end
end
