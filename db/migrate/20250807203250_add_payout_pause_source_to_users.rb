# frozen_string_literal: true

class AddPayoutPauseSourceToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :payout_pause_source, :string
    add_column :users, :payout_pause_reason, :text
    add_index :users, :payout_pause_source

    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE users#{' '}
          SET payout_pause_source = 'admin'#{' '}
          WHERE (flags & POW(2, 20)) != 0
        SQL
      end
    end
  end
end
