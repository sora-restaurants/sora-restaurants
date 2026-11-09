-- Drop the legacy, un-optimized dashboard index
DROP INDEX IF EXISTS orders_kitchen;

-- Create the high-performance conditional index for the real-time kitchen board
CREATE INDEX idx_active_kitchen_orders
ON orders (restaurant_id, status)
WHERE status IN ('submitted', 'accepted', 'preparing', 'ready');
