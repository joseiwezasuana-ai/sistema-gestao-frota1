# Security Specification for TaxiControl

## Data Invariants
1. **Users**: Every user must have a role. Role changes are restricted to admins.
2. **Revenue Logs**: A driver can only submit their own revenue. Once approved or finalized, it becomes immutable except for status changes by authorized staff.
3. **Panic Alerts**: Only drivers can create panic alerts. Status updates are for staff.
4. **Internal Contracts**: Drivers can propose contracts. Activation is restricted to staff.
5. **Inventory**: Stock cannot be negative. Movements must be associated with a user.

## The "Dirty Dozen" Payloads (Targets for DENY)
1. **Self-Promotion**: User trying to update their own role from 'driver' to 'admin'.
2. **Shadow Revenue**: Driver submitting revenue with `amount: 999999999` and `isVerified: true` (Ghost Field).
3. **Identity Spoofing**: User A trying to delete User B's internal contract.
4. **Time Travel**: Driver submitting revenue with `timestamp: '2099-01-01'`.
5. **Resource Exhaustion**: Creating a document with a 1MB string as ID.
6. **Orphaned Write**: Creating a maintenance log for a non-existent vehicle ID.
7. **Bypassing Validation**: Updating `monthlyValue` without the staff role.
8. **Unauthorized List**: Attempting to list all `revenue_logs` as an unauthenticated user.
9. **Duplicate Shift**: Trying to create a shift for a date that already has one (client-side lock, rules enforce relational integrity if possible).
10. **Admin Hijack**: Trying to register as a master admin email without verification.
11. **Negative Inventory**: Setting `WarehouseItem.stock` to -100.
12. **Status Skipping**: Moving a revenue log from `vended_by_driver` directly to `finalized` without operator approval (if tiered).

## Conflict Report
| Collection | Identity Spoofing | State Shortcutting | Value Poisoning |
|---|---|---|---|
| users | Protected (uid check) | Protected | Protected (keys check) |
| revenue_logs | Protected (driverId check) | Protected (status path) | Protected (size check) |
| internal_contracts | Protected | Protected | Protected |
| panic_alerts | Protected | Protected | Protected |
| warehouse_inventory | Protected | Protected | Protected |
