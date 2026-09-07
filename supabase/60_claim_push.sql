-- ============================================================================
-- Rich & Friends, migration 60: reprendre un abonnement push a soi
--
-- Run after 49. Safe to re-run.
--
-- CE QUI A ETE RAPPORTE
--
--   Capture des reglages, l'interrupteur allume, et en rouge dessous:
--
--     23505: duplicate key value violates unique constraint
--            "push_subscription_pkey"
--
--   Puis, plusieurs fois: "I still did not receive any drink water
--   notification".
--
--   Les deux sont la meme chose. Sans ligne, la fonction planifiee n'a aucune
--   adresse ou envoyer, donc elle envoie a personne, en silence, et tout le
--   reste du systeme de rappels peut etre parfaitement en place sans que rien
--   n'arrive jamais.
--
-- CE QUI SE PASSE VRAIMENT
--
--   endpoint est la cle primaire de push_subscription: une ligne par
--   navigateur, pas une par personne. Le navigateur, lui, garde le meme
--   endpoint tant que la cle VAPID publique ne change pas, y compris a travers
--   une deconnexion et une reconnexion sous un autre compte.
--
--   Donc: ce navigateur a ete abonne une premiere fois sous un identifiant de
--   compte, l'abonnement a ete repris sous un autre, et la ligne est restee au
--   premier. Le client fait un delete puis un insert; le delete est filtre par
--   RLS et ne voit pas une ligne qui appartient a quelqu'un d'autre, donc il
--   supprime zero ligne sans erreur, et l'insert tombe sur la cle primaire.
--   L'erreur est correcte et sans issue: il n'existe aucune requete que ce
--   client puisse envoyer pour se sortir de la.
--
-- LA SORTIE, ET CE QU'ELLE COUTE
--
--   Une fonction SECURITY DEFINER qui supprime la ligne de cet endpoint, quel
--   qu'en soit le proprietaire, et la recree pour l'appelant.
--
--   Ce qu'il faut fournir: l'endpoint ET les deux secrets du navigateur
--   (p256dh, auth). C'est la preuve de possession. Un endpoint n'est pas un
--   identifiant devinable, c'est une capacite: qui l'a peut deja poster une
--   notification a cet appareil sans passer par nous.
--
--   Le pire cas est donc: quelqu'un qui detient DEJA ton endpoint redirige ses
--   propres notifications vers ton appareil et cesse de recevoir les siennes.
--   Il ne lit rien de ce qui t'etait destine: le contenu est chiffre pour les
--   cles de la ligne et livre a ce meme appareil. C'est le comportement de
--   tout upsert-par-endpoint, et c'est le prix d'un interrupteur qui peut se
--   reparer tout seul.
--
--   Ce qu'elle ne fait PAS: rendre une ligne lisible. Les policies de 49
--   restent telles quelles, personne ne peut lire l'endpoint d'un autre, et
--   cette fonction ne rend rien d'autre que l'endpoint qu'on lui a passe.
-- ============================================================================

create or replace function claim_push_subscription(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if p_endpoint is null or length(p_endpoint) < 8
     or p_p256dh is null or p_auth is null then
    raise exception 'endpoint and keys are required';
  end if;

  -- Sans filtre de proprietaire: c'est toute la raison d'etre de la fonction.
  delete from push_subscription where endpoint = p_endpoint;

  insert into push_subscription (endpoint, user_id, p256dh, auth)
  values (p_endpoint, me, p_p256dh, p_auth);

  return p_endpoint;
end;
$$;

-- anon n'a rien a reprendre: il faut un compte pour posseder une ligne.
revoke all on function claim_push_subscription(text, text, text) from public, anon;
grant execute on function claim_push_subscription(text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   select proname from pg_proc where proname = 'claim_push_subscription';
--   -- puis, dans l'application: Reglages, couper et rallumer l'interrupteur.
--   select user_id, left(endpoint, 40), created_at from push_subscription;
