CREATE INDEX IF NOT EXISTS idx_orders_completed_at_popular
  ON public.orders(completed_at DESC)
  WHERE status = 'completed' AND completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_collected_at_popular
  ON public.orders(collected_at DESC)
  WHERE status = 'collected' AND collected_at IS NOT NULL;
