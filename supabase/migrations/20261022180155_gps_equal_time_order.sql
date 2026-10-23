-- Equal fix timestamps retain the first successfully received position. Packet arrival
-- may extend history but only a strictly newer fix can move current location.
drop index public.gps_positions_assignment_latest;
create index gps_positions_assignment_latest on public.gps_positions
 (business_id,assignment_id,recorded_at desc,received_at asc,id asc);
