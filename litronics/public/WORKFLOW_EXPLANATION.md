# Litronics Purchase & Payment Workflow Guide

This guide explains the end-to-end flow of the Purchase and Payment modules in the Litronics system. It is designed to help you demonstrate the system to clients.

## 1. Product & Supplier Setup (Prerequisites)
Before creating orders, the system relies on a catalog of **Products** and **Suppliers**.
*   **Products**: Defined with a Part Code, Description, Category, and Base Prices (USD/RMB/INR).
*   **Suppliers**: The vendors we buy from.
*   **HSN Codes**: Codes that determine Taxes (GST) and Customs Duties (BCD).

## 2. Creating a Purchase Order (Procurement)
When you need to buy stock, you create a **Purchase Order (PO)**.
1.  Navigate to the **Purchase** module.
2.  Click **"New Order"**.
3.  **Select a Product**: The form auto-fills details (Part Code, Category, HSN) to save time.
4.  **Select a Supplier**: Choose who you are buying from.
5.  **Enter Quantity & Price**:
    *   You can choose the currency (USD, RMB, INR).
    *   The system automatically calculates the **Subtotal**.
6.  **Add Charges**:
    *   **Other Charges**: Freight, insurance, etc.
    *   **GST**: Auto-calculated based on % (usually 18%).
7.  **Result**: The system calculates the **Final Total Amount** that you owe the supplier.
    *   *Status*: The order starts as "OPEN".

## 3. Viewing Pending Payments (Accounts)
Once orders are created, the system tracks how much you owe each supplier.
1.  Click the **"Payments"** button in the Purchase module.
2.  You will see a **Summary Table** showing:
    *   **Total Purchase Value**: Sum of all orders ever placed with that supplier.
    *   **Total Paid**: How much you have already paid them.
    *   **Pending Balance**: `Total Value - Total Paid`.
    *   **Status**:
        *   🔴 **Pending**: No payments made yet.
        *   🟡 **Partial**: Some amount paid, but balance remains.
        *   🟢 **Paid**: Fully settled (Balance is 0).

## 4. Recording a Payment (Settlement)
When you transfer money to a supplier:
1.  In the "Payments" summary, find the supplier.
2.  Click the **"Pay"** button.
3.  A form appears with the **Supplier Name** and their current **Pending Balance**.
4.  **Enter Payment Details**:
    *   **Amount**: How much you are paying today.
    *   **Date**: When the payment was made.
    *   **Mode**: Bank Transfer, Cheque, Cash, etc.
    *   **Reference**: Transaction ID or UTR number.
5.  Click **"Save Payment"**.

## 5. System Logic & partial Status
*   **Auto-Calculation**: The system adds this new payment to the supplier's "Total Paid" record.
*   **Balance Update**: The Pending Balance is instantly reduced by the paid amount.
*   **Status Update**:
    *   If `Paid Amount < Total Owed` → Status shows **"Partial"**.
    *   If `Paid Amount >= Total Owed` → Status shows **"Paid"**.
    *   *Note: Detailed breakdowns calculate strictly based on 2 decimal places to ensure accuracy.*

## 6. Supplier History
You can also view a detailed history for any supplier:
1.  Click the **Eye Icon (👁️)** next to a supplier in the payment list.
2.  This shows a ledger of every single Order vs. every single Payment, helping you reconcile accounts if there are discrepancies.
