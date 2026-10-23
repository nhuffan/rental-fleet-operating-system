-- Cover all composite FK columns for assignment lifecycle/maintenance checks.
create index gps_positions_assignment_identity on public.gps_positions
 (business_id,assignment_id,device_id,vehicle_id);
