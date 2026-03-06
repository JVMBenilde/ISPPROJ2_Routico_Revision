/*
Database: routico

Table: billing
Columns:
billing_id int AI PK 
owner_id int 
billing_period date 
flat_fee decimal(10,2) 
total_commission decimal(10,2) 
total_due decimal(10,2) 
status varchar(20) 
generated_at datetime
payment_proof_path varchar(255)  -- MinIO object key for payment proof file

Table: businessowners
Columns:
owner_id int AI PK 
user_id int 
company_name varchar(255)

Table: customers
Columns:
customer_id int AI PK 
company_name varchar(255) 
address text 
contact_number varchar(20)

Table: deliverystatuslogs
Columns:
status_log_id int AI PK 
order_id int 
status varchar(50) 
timestamp datetime

Table: drivers
Columns:
driver_id int AI PK 
owner_id int 
user_id int 
license_number varchar(50)

Table: fleetlocations
Columns:
fleet_location_id int AI PK 
truck_id int 
current_location varchar(255) 
last_updated datetime

Table: issues
Columns:
issue_id int AI PK 
reported_by int 
order_id int 
category_id int 
description text 
proof_attachment text 
status varchar(20) 
reported_at datetime

Table: issuescategories
Columns:
category_id int AI PK 
category_name varchar(100) 
description text

Table: notifications
Columns:
notification_id int AI PK 
user_id int 
message varchar(100) 
status varchar(20) 
created_at datetime

Table: orders
Columns:
order_id int AI PK 
truck_id int 
business_owner_id int 
assigned_driver_id int 
customer_id int 
weight decimal(10,2) 
size varchar(50) 
order_status varchar(50) 
proof_of_delivery text 
pickup_location varchar(255) 
drop_off_location varchar(255) 
scheduled_delivery_time datetime 
order_created_at datetime 
order_updated_at datetime

Table: reports
Columns:
report_id int AI PK 
generated_by int 
report_type varchar(100) 
generated_at datetime 
file_path text

Table: routeoptimization
Columns:
route_id int AI PK 
multi_order_group_id int 
start_location varchar(255) 
destination varchar(255) 
estimated_distance decimal(10,2) 
estimated_time time 
optimized_route text 
fuel_efficiency decimal(10,2)

Table: routeorders
Columns:
route_order_id int AI PK 
route_id int 
order_id int

Table: subscriptions
Columns:
subscription_id int AI PK 
owner_id int 
payment_proof varchar(255)  -- MinIO object key for payment proof file
payment_date datetime 
approval_status varchar(50)

Table: systemlogs
Columns:
log_id int AI PK 
user_id int 
action_type varchar(255) 
affected_table varchar(255) 
affected_record_id int 
timestamp datetime

Table: tracking
Columns:
tracking_id int AI PK 
order_id int 
driver_id int 
current_location varchar(255) 
timestamp datetime

Table: trucks
Columns:
truck_id int AI PK 
owner_id int 
plate_number varchar(50) 
model varchar(100) 
capacity decimal(10,2) 
status varchar(20)

Table: users
Columns:
user_id int AI PK 
full_name varchar(255) 
email varchar(255) 
password_hash varchar(255) 
phone varchar(20) 
account_status varchar(20) 
active_status varchar(20) 
created_at datetime 
role varchar(50)

*/