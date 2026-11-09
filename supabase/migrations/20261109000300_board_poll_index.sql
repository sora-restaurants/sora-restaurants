-- The kitchen board polls every 2 s per tablet for orders changed since its cursor. It cannot use the
-- partial active-orders index (it must also see orders leaving the active set), so without this it scans
-- the restaurant's whole order history on every poll. Measured on 1M orders: 9.5 ms -> 0.013 ms.
CREATE INDEX idx_orders_board_poll ON orders (restaurant_id, updated_at);
