# Architecture rules

- Build customer arrears notices through the shared report formatter so printed notices and WhatsApp messages use identical unpaid balances and payment information.
- Render the customer print sheet in a body-level portal with isolated print styles so navigation, other customers and dialog controls never appear on paper.
- Print the customer directory from the currently filtered list in an isolated body portal; repeat column headers and keep rows intact across paper pages.