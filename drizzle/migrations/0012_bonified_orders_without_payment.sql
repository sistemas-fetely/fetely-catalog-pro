CREATE OR REPLACE FUNCTION public.sync_orders_commercial_extraidas()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.commercial IS NOT NULL THEN
    NEW.forma_pagamento := CASE
      WHEN NEW.commercial->>'condicaoDescricao' = 'Pedido bonificado'
        OR NEW.commercial->>'bonificado' = 'true'
      THEN 'sem_pagamento'
      ELSE NULLIF(NEW.commercial->>'condicaoDescricao', '')
    END;
    NEW.frete := NULLIF(NEW.commercial->>'frete', '');
    NEW.valor_bruto := NULLIF(NEW.commercial->>'bruto', '')::numeric;
    NEW.valor_liquido := NULLIF(NEW.commercial->>'totalFinal', '')::numeric;
    NEW.tem_negociacao := COALESCE((NEW.commercial->>'negociacao')::boolean, false);
    NEW.tem_premissa_aplicada := COALESCE((NEW.commercial->>'premissasAplicadas')::boolean, false);
  ELSE
    NEW.forma_pagamento := NULL;
    NEW.frete := NULL;
    NEW.valor_bruto := NULL;
    NEW.valor_liquido := NULL;
    NEW.tem_negociacao := false;
    NEW.tem_premissa_aplicada := false;
  END IF;
  RETURN NEW;
END;
$function$;