class SupportController < Sellers::BaseController
  include HelperWidget

  def index
    timestamp = (Time.current.to_f * 1000).to_i
    email_hash = OpenSSL::HMAC.hexdigest(
      "sha256",
      GlobalConfig.get("HELPER_WIDGET_SECRET"),
      "#{current_seller.email}:#{timestamp}"
    )

    session = {
      email: email,
      emailHash: email_hash,
      timestamp: timestamp,
    }

    @props = {
      host: helper_widget_host,
      session: session,
    }
  end
end
