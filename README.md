# CoreBank Backend API

This backend provides endpoints for token/pool integration, investment management, and dashboard analytics for DeFi investments.

## Task List & API Endpoints

### 1. 📦 Token & Pool Integration

- **GET `/tokens`**
  - Returns a list of supported tokens for investment.
  - **Fields:** `symbol`, `name`, `decimals`, `min_amount`, `max_amount`, `status`

- **GET `/protocols`**
  - Returns a list of DeFi protocols CoreBank integrates with (e.g., Aave, Lido, custom pools).
  - **Fields:** `protocol_name`, `description`, `token_types`, `allocation_options`

---

### 2. 🧾 Investment Management

- **POST `/investment`**
  - Saves a new investment record.
  - **Fields:** `amount`, `token`, `start_time`, `end_time`, `fee`, `owner_address`, `status`

- **POST `/withdraw`**
  - Processes withdrawal requests.
  - Checks for early exit and applies fee if necessary.
  - Updates status and returns net amount.

- **GET `/investments/:user_address`**
  - Returns a user's portfolio: active, withdrawn, and pending investments.

---

### 3. 📊 Dashboard & Analytics API

- **GET `/dashboard/overview`**
  - Returns aggregated performance metrics for UI.
  - **Example Data:**
    - Total value locked (TVL)
    - Total returns distributed
    - Avg. holding duration
    - Early withdrawal rate

- **GET `/dashboard/user/:user_address`**
  - Returns personal investment performance.
  - **Includes:**
    - Total invested
    - Current positions
    - ROI / APY estimation
    - Historical withdrawals

---

## Getting Started

1. Clone the repository.
2. Install dependencies.
3. Start the backend server.
4. Use the above endpoints for integration.

## Contributing

- Follow the API structure above.
- Document new endpoints and data fields.
- Ensure tests cover all major flows.

---