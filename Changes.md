# FridgePolice — Changes

## Overview
FridgePolice is a shared-fridge inventory management application that helps roommates track food, request portions, manage approvals, and correct inventory when real-world events differ from the app.

## Features Implemented
- **Food inventory:** Add and track food items, owners, quantities, and unique item IDs.
- **Portion requests:** Roommates can request food portions from another owner.
- **Approval workflow:** Owners can approve or reject requests. Approval checks available inventory to prevent double allocation.
- **Reservation expiry:** Approved portions expire after 24 hours if not consumed, releasing the reservation.
- **Unique item identity:** Separate entries for identical foods are tracked independently.
- **Consumption tracking:** Consuming an approved portion updates the recorded quantity and request status.
- **Physical inventory correction:** Record food consumed outside the app, missing food, or spoiled food.
- **Activity log:** Record consumption and inventory corrections.
- **Persistent state:** Save application data in browser local storage.

## UI Improvements
- Redesigned the interface with a clean, minimal green theme.
- Improved inventory cards, status indicators, forms, and request actions.
- Added clearer inventory search and filtering where supported by the implementation.
- Improved layout responsiveness and visual consistency.

## Validation
The application was built using React and Vite.

The four required scenarios were manually tested:
1. Competing requests: the second approval is rejected when the available quantity is no longer sufficient.
2. Stale approvals: expiry releases reserved portions.
3. Identical items: separate food entries retain distinct identities.
4. Inventory correction: corrections update the appropriate item and related activity/request records.

## Implementation Notes
- Inventory and request state is persisted using browser local storage.
- The application is a client-side demonstration; it does not provide server-side, multi-user transactional concurrency control.
