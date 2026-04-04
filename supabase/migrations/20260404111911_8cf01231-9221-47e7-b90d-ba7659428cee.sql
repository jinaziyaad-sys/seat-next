
DO $$
DECLARE
  v_order RECORD;
  v_program RECORD;
  v_loyalty RECORD;
  v_reward RECORD;
  v_code TEXT;
  v_stamps_awarded INT := 0;
BEGIN
  FOR v_order IN
    SELECT o.id, o.user_id, o.venue_id, o.updated_at
    FROM orders o
    JOIN loyalty_programs lp ON lp.venue_id = o.venue_id AND lp.is_active = true AND lp.admin_enabled = true
    WHERE o.status = 'collected'
      AND o.user_id IS NOT NULL
      AND 'order' = ANY(lp.earning_sources)
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_transactions lt WHERE lt.source_id = o.id AND lt.type IN ('stamp_earned', 'points_earned')
      )
    ORDER BY o.updated_at ASC
  LOOP
    SELECT * INTO v_program FROM loyalty_programs
    WHERE venue_id = v_order.venue_id AND is_active = true AND admin_enabled = true;
    
    IF v_program IS NOT NULL AND v_program.type = 'stamp_card' THEN
      INSERT INTO patron_loyalty (user_id, venue_id, program_id, stamps_count, points_balance, lifetime_stamps, lifetime_points)
      VALUES (v_order.user_id, v_order.venue_id, v_program.id, 0, 0, 0, 0)
      ON CONFLICT (user_id, venue_id) DO NOTHING;
      
      UPDATE patron_loyalty
      SET stamps_count = stamps_count + 1, lifetime_stamps = lifetime_stamps + 1, updated_at = now()
      WHERE user_id = v_order.user_id AND venue_id = v_order.venue_id;
      
      INSERT INTO loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type, source_id)
      VALUES (v_order.user_id, v_order.venue_id, v_program.id, 'stamp_earned', 1, 'order', v_order.id);
      
      v_stamps_awarded := v_stamps_awarded + 1;
      
      -- Check if threshold reached, auto-redeem
      SELECT * INTO v_loyalty FROM patron_loyalty WHERE user_id = v_order.user_id AND venue_id = v_order.venue_id;
      IF v_loyalty.stamps_count >= v_program.stamp_threshold THEN
        SELECT * INTO v_reward FROM loyalty_rewards
        WHERE program_id = v_program.id AND is_active = true
        ORDER BY stamps_required ASC NULLS LAST LIMIT 1;
        
        IF v_reward IS NOT NULL THEN
          v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
          INSERT INTO discount_codes (venue_id, user_id, code, reward_id, reward_name)
          VALUES (v_order.venue_id, v_order.user_id, v_code, v_reward.id, v_reward.name);
          
          UPDATE patron_loyalty SET stamps_count = 0, updated_at = now()
          WHERE user_id = v_order.user_id AND venue_id = v_order.venue_id;
          
          INSERT INTO loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type)
          VALUES (v_order.user_id, v_order.venue_id, v_program.id, 'stamps_reset', -v_loyalty.stamps_count, 'reward');
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RAISE LOG 'Loyalty reconciliation: awarded % missed stamps', v_stamps_awarded;
END $$;
