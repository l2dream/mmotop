-- The reward can be taken two ways now: notifications pushed to the owner's
-- address, or the votes-list function, which the game server reads by
-- itself. So "reward on" no longer needs an address: switched on, the vote
-- box asks for the nickname either way, and a notification goes out only
-- when there is an address to send it to.
create or replace function public.server_postbacks_reward() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.servers set reward = new.enabled
  where id = new.server_id and reward is distinct from new.enabled;
  return new;
end $$;
