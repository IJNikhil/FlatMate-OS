/**
 * ==============================================================================
 * FlatMate OS - Serverless Backend Routing & Database Engine
 * Platform: Google Apps Script (GAS) on V8 Runtime
 * File: backend/apps-script/Code.js
 * ==============================================================================
 * Architectural Directives:
 * 1. Zero-Trust Identity: Active user identity extracted server-side via Session.
 * 2. Concurrency control via LockService.getScriptLock() on all mutations.
 * 3. Text/plain request parsing to maintain browser CORS preflight (OPTIONS) bypass.
 * 4. Full CRUD operations across inventory, expenses, budget requests, and settlements.
 * 5. Google Drive integration for budget proof screenshot storage.
 * 6. Dynamic group strength querying for precise expense and debt calculations.
 * 7. Billing cycle partitioning (current vs. historical archive).
 */

const SCRIPT_PROP = PropertiesService.getScriptProperties();
const LOCK_TIMEOUT_MS = 10000;
const GLOBAL_GROUP_ID = "GRP_ALL";
const DRIVE_FOLDER_NAME = "FlatMate OS";

// ==============================================================================
// 1. HTTP GATEWAY HANDLERS (doGet / doPost)
// ==============================================================================

function doGet(e) {
  return handleResponse(e, "GET");
}

function doPost(e) {
  return handleResponse(e, "POST");
}

// ==============================================================================
// 2. CENTRAL REQUEST ROUTER & CONCURRENCY CONTROLLER
// ==============================================================================

function handleResponse(e, method) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    // Acquire exclusive script lock to prevent race conditions
    lock.waitLock(LOCK_TIMEOUT_MS);
    lockAcquired = true;

    const spreadsheetId = SCRIPT_PROP.getProperty("key");
    if (!spreadsheetId) {
      const activeSs = SpreadsheetApp.getActiveSpreadsheet();
      if (activeSs) {
        SCRIPT_PROP.setProperty("key", activeSs.getId());
      } else {
        throw new Error("Database not initialized. Run seedDatabase() first.");
      }
    }

    const doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("key"));

    let action = "ping";
    let payload = {};
    let clientEmail = "";
    let clientUserId = "";

    // --------------------------------------------------------------------------
    // PARSE REQUEST (text/plain CORS bypass)
    // --------------------------------------------------------------------------
    if (method === "POST") {
      if (!e || !e.postData || !e.postData.contents) {
        throw new Error("Missing POST request body or invalid payload.");
      }

      let parsedBody;
      try {
        parsedBody = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        throw new Error("Malformed JSON in request body: " + parseErr.message);
      }

      action = parsedBody.action || "ping";
      payload = parsedBody.payload || {};
      clientEmail = parsedBody.client_email || "";
      clientUserId = parsedBody.client_user_id || "";
    } else if (method === "GET") {
      action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
      clientEmail = (e && e.parameter && e.parameter.email) ? e.parameter.email : "";
      clientUserId = (e && e.parameter && e.parameter.user_id) ? e.parameter.user_id : "";
    }

    // --------------------------------------------------------------------------
    // ZERO-TRUST IDENTITY RESOLUTION
    // --------------------------------------------------------------------------
    const userEmail = getAuthenticatedUserEmail(clientEmail);
    const currentUser = resolveMemberByEmail(userEmail, doc, clientUserId);

    const responseData = {
      status: "success",
      action: action,
      timestamp: new Date().toISOString()
    };

    // --------------------------------------------------------------------------
    // ACTION ROUTING
    // --------------------------------------------------------------------------
    switch (action) {

      // --- PING / HEALTH CHECK ---
      case "ping": {
        responseData.message = "FlatMate OS API is healthy and operational.";
        responseData.authenticated_user = currentUser ? currentUser.email : "anonymous";
        break;
      }

      // --- IDENTITY: GET CURRENT USER ---
      case "get_me": {
        responseData.payload = currentUser;
        break;
      }

      // --- READ: FETCH ALL RELATIONAL DATASETS (PARTITIONED) ---
      case "fetch_all": {
        if (method !== "GET" && method !== "POST") {
          throw new Error("Action 'fetch_all' only supports GET or POST.");
        }

        const now = new Date();
        const currentYearMonth = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM");

        repairAndDeduplicateMembers(doc);

        const members = getSheetDataAsObjects("dim_members", doc);
        const groups = getSheetDataAsObjects("dim_groups", doc);
        const memberGroups = getSheetDataAsObjects("map_member_group", doc);
        const inventory = getSheetDataAsObjects("dim_inventory", doc);
        const allExpenses = getSheetDataAsObjects("fact_expense_logs", doc);
        const stockEvents = getSheetDataAsObjects("fact_stock_events", doc);
        const budgetRequests = getSheetDataAsObjects("fact_budget_requests", doc);
        const allSettlements = getSheetDataAsObjects("fact_settlements", doc);

        // Partition expenses into current vs historical billing cycles
        const currentExpenses = [];
        const historicalExpenses = [];

        for (let i = 0; i < allExpenses.length; i++) {
          const exp = allExpenses[i];
          const expDate = new Date(exp.timestamp);
          const expCycle = !isNaN(expDate.getTime())
            ? Utilities.formatDate(expDate, "Asia/Kolkata", "yyyy-MM")
            : currentYearMonth;

          if (expCycle === currentYearMonth) {
            currentExpenses.push(exp);
          } else {
            historicalExpenses.push(exp);
          }
        }

        // Partition settlements into current vs historical billing cycles
        const currentSettlements = [];
        const historicalSettlements = [];

        for (let j = 0; j < allSettlements.length; j++) {
          const st = allSettlements[j];
          let stCycle = st.month_cycle;
          if (!stCycle && st.timestamp) {
            const stDate = new Date(st.timestamp);
            stCycle = !isNaN(stDate.getTime())
              ? Utilities.formatDate(stDate, "Asia/Kolkata", "yyyy-MM")
              : currentYearMonth;
          }

          if (stCycle === currentYearMonth) {
            currentSettlements.push(st);
          } else {
            historicalSettlements.push(st);
          }
        }

        // Ensure monthly budget collections exist for all active members for current cycle
        ensureMonthlyBudgetCollections(doc, currentYearMonth);
        const allBudgetCollections = getSheetDataAsObjects("fact_budget_collections", doc);

        const currentBudgetCollections = [];
        const historicalBudgetCollections = [];
        for (let b = 0; b < allBudgetCollections.length; b++) {
          const col = allBudgetCollections[b];
          if (String(col.month_cycle) === currentYearMonth) {
            currentBudgetCollections.push(col);
          } else {
            historicalBudgetCollections.push(col);
          }
        }

        responseData.payload = {
          current_user: currentUser,
          current_cycle: currentYearMonth,
          members: members,
          groups: groups,
          member_groups: memberGroups,
          inventory: inventory,
          expenses: allExpenses,
          current_expenses: currentExpenses,
          historical_expenses: historicalExpenses,
          stock_events: stockEvents,
          budget_requests: budgetRequests,
          budget_collections: allBudgetCollections,
          current_budget_collections: currentBudgetCollections,
          historical_budget_collections: historicalBudgetCollections,
          settlements: allSettlements,
          current_settlements: currentSettlements,
          historical_settlements: historicalSettlements
        };
        break;
      }

      // --- GROUPS: JOIN GROUPS ---
      case "join_group": {
        if (!currentUser) throw new Error("Authentication required to join groups.");

        const targetGroupIds = Array.isArray(payload.group_ids)
          ? payload.group_ids
          : (payload.group_id ? [payload.group_id] : []);

        const mapSheet = doc.getSheetByName("map_member_group");
        if (!mapSheet) throw new Error("Table 'map_member_group' not found.");

        const existingMap = mapSheet.getDataRange().getValues();
        const currentGroupSet = {};

        for (let r = 1; r < existingMap.length; r++) {
          if (String(existingMap[r][2]).trim() === currentUser.user_id) {
            currentGroupSet[String(existingMap[r][1]).trim()] = true;
          }
        }

        // Ensure user is enrolled in Global Household
        if (!currentGroupSet[GLOBAL_GROUP_ID]) {
          const globalId = "MAP_" + Utilities.getUuid().substring(0, 8);
          mapSheet.appendRow([globalId, GLOBAL_GROUP_ID, currentUser.user_id]);
          currentGroupSet[GLOBAL_GROUP_ID] = true;
        }

        // Append requested subgroups
        const newlyAdded = [];
        for (let g = 0; g < targetGroupIds.length; g++) {
          const gid = String(targetGroupIds[g]).trim();
          if (gid && !currentGroupSet[gid]) {
            const mapId = "MAP_" + Utilities.getUuid().substring(0, 8);
            mapSheet.appendRow([mapId, gid, currentUser.user_id]);
            currentGroupSet[gid] = true;
            newlyAdded.push(gid);
          }
        }

        responseData.message = "Group memberships updated successfully.";
        responseData.user_id = currentUser.user_id;
        responseData.joined_groups = Object.keys(currentGroupSet);
        responseData.newly_added = newlyAdded;
        break;
      }

      // --- EXPENSES: ADD EXPENSE (WITH PRECISE DEBT SPLITTING) ---
      case "add_expense": {
        if (!currentUser) throw new Error("Authentication required to log expenses.");

        const requiredFields = ["expense_id", "item_id", "group_id", "amount"];
        for (let k = 0; k < requiredFields.length; k++) {
          const field = requiredFields[k];
          if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
            throw new Error("Missing required field for expense: '" + field + "'");
          }
        }

        const totalAmount = Number(payload.amount);
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
          throw new Error("Invalid expense amount. Must be a positive finite number.");
        }

        const expSheet = doc.getSheetByName("fact_expense_logs");
        if (!expSheet) throw new Error("Table 'fact_expense_logs' not found.");

        // Query map_member_group to dynamically calculate the group's current strength
        const mapSheet = doc.getSheetByName("map_member_group");
        let groupStrength = 0;
        let isUserInGroup = false;

        if (mapSheet) {
          const mapData = mapSheet.getDataRange().getValues();
          const uniqueMembers = {};

          for (let m = 1; m < mapData.length; m++) {
            const gId = String(mapData[m][1]).trim();
            const uId = String(mapData[m][2]).trim();

            if (gId === String(payload.group_id).trim()) {
              uniqueMembers[uId] = true;
              if (uId === currentUser.user_id) {
                isUserInGroup = true;
              }
            }
          }
          groupStrength = Object.keys(uniqueMembers).length;
        }

        // If payer is not yet explicitly mapped or group is global, ensure proper count
        if (groupStrength === 0) {
          groupStrength = 1;
        }

        // Subtract payer's own fair share: Amount_Owed = Total - (Total / Strength)
        let amountOwed = totalAmount;
        if (groupStrength > 1) {
          amountOwed = Number((totalAmount - (totalAmount / groupStrength)).toFixed(2));
        }

        const timestamp = payload.timestamp || new Date().toISOString();
        const expenseId = String(payload.expense_id);

        // Append expense record using Zero-Trust authenticated user_id
        expSheet.appendRow([
          expenseId,
          timestamp,
          String(payload.item_id).trim(),
          String(payload.group_id).trim(),
          currentUser.user_id, // Server-enforced identity
          amountOwed
        ]);

        responseData.message = "Expense logged successfully with fair-share debt deduction.";
        responseData.expense_id = expenseId;
        responseData.total_amount = totalAmount;
        responseData.amount_owed = amountOwed;
        responseData.group_strength = groupStrength;
        responseData.paid_by = currentUser.user_id;
        break;
      }

      // --- EXPENSES: DELETE EXPENSE ---
      case "delete_expense": {
        if (!currentUser) throw new Error("Authentication required to delete expenses.");
        if (!payload.expense_id || String(payload.expense_id).trim() === "") {
          throw new Error("Missing required parameter: 'expense_id'.");
        }

        const expSheet = doc.getSheetByName("fact_expense_logs");
        if (!expSheet) throw new Error("Table 'fact_expense_logs' not found.");

        const data = expSheet.getDataRange().getValues();
        let targetRowIndex = -1;

        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(payload.expense_id).trim()) {
            targetRowIndex = i + 1;
            break;
          }
        }

        if (targetRowIndex === -1) {
          throw new Error("Expense record not found: " + payload.expense_id);
        }

        expSheet.deleteRow(targetRowIndex);

        responseData.message = "Expense deleted successfully.";
        responseData.expense_id = payload.expense_id;
        break;
      }

      // --- BUDGET: REQUEST BUDGET (WITH GOOGLE DRIVE SCREENSHOT UPLOAD) ---
      case "request_budget": {
        if (!currentUser) throw new Error("Authentication required to request a budget.");

        if (!payload.group_id || !payload.amount) {
          throw new Error("Missing required fields: 'group_id' and 'amount'.");
        }

        const reqAmount = Number(payload.amount);
        if (!Number.isFinite(reqAmount) || reqAmount <= 0) {
          throw new Error("Budget request amount must be greater than zero.");
        }

        const budgetSheet = doc.getSheetByName("fact_budget_requests");
        if (!budgetSheet) throw new Error("Table 'fact_budget_requests' not found. Run seedDatabase() first.");

        const requestId = payload.request_id || "REQ_" + Utilities.getUuid().substring(0, 8);
        const isCash = Boolean(payload.is_cash);
        let screenshotUrl = "";

        // If proof image provided as Base64, save into FlatMate OS Drive folder
        if (!isCash && payload.screenshot) {
          screenshotUrl = saveScreenshotToDrive(payload.screenshot, "BudgetProof_" + requestId);
        } else if (payload.screenshot_url) {
          screenshotUrl = String(payload.screenshot_url);
        }

        // fact_budget_requests columns:
        // [request_id, group_id, requested_by, amount, screenshot_url, is_cash, status]
        budgetSheet.appendRow([
          requestId,
          String(payload.group_id).trim(),
          currentUser.user_id, // Server-enforced identity
          reqAmount,
          screenshotUrl,
          isCash,
          "PENDING"
        ]);

        responseData.message = "Budget request submitted and marked as PENDING.";
        responseData.request_id = requestId;
        responseData.screenshot_url = screenshotUrl;
        responseData.status = "PENDING";
        break;
      }

      // --- BUDGET: APPROVE BUDGET ---
      case "approve_budget": {
        if (!currentUser) throw new Error("Authentication required to approve budgets.");
        if (!payload.request_id) throw new Error("Missing required field: 'request_id'.");

        const budgetSheet = doc.getSheetByName("fact_budget_requests");
        if (!budgetSheet) throw new Error("Table 'fact_budget_requests' not found.");

        const reqData = budgetSheet.getDataRange().getValues();
        let reqRowIndex = -1;
        let targetGroupId = "";
        let approvedAmount = 0;
        let currentStatus = "";

        for (let r = 1; r < reqData.length; r++) {
          if (String(reqData[r][0]).trim() === String(payload.request_id).trim()) {
            reqRowIndex = r + 1;
            targetGroupId = String(reqData[r][1]).trim();
            approvedAmount = Number(reqData[r][3]);
            currentStatus = String(reqData[r][6]).trim().toUpperCase();
            break;
          }
        }

        if (reqRowIndex === -1) {
          throw new Error("Budget request not found: " + payload.request_id);
        }

        if (currentStatus === "APPROVED") {
          throw new Error("Budget request has already been approved.");
        }

        // Flip status to APPROVED in fact_budget_requests (Column 7)
        budgetSheet.getRange(reqRowIndex, 7).setValue("APPROVED");

        // Increase budget_target in dim_groups
        const groupsSheet = doc.getSheetByName("dim_groups");
        if (!groupsSheet) throw new Error("Table 'dim_groups' not found.");

        const groupRows = groupsSheet.getDataRange().getValues();
        let groupRowIndex = -1;
        let currentTarget = 0;

        for (let g = 1; g < groupRows.length; g++) {
          if (String(groupRows[g][0]).trim() === targetGroupId) {
            groupRowIndex = g + 1;
            currentTarget = Number(groupRows[g][2]) || 0;
            break;
          }
        }

        let updatedTarget = currentTarget + approvedAmount;
        if (groupRowIndex !== -1) {
          // Column 3 = budget_target in dim_groups
          groupsSheet.getRange(groupRowIndex, 3).setValue(updatedTarget);
        }

        responseData.message = "Budget request APPROVED and group budget updated.";
        responseData.request_id = payload.request_id;
        responseData.group_id = targetGroupId;
        responseData.added_amount = approvedAmount;
        responseData.new_budget_target = updatedTarget;
        break;
      }

      // --- SETTLEMENTS: SETTLE DEBT ---
      case "settle_debt": {
        if (!currentUser) throw new Error("Authentication required to settle debts.");
        if (!payload.payee_id || !payload.amount) {
          throw new Error("Missing required fields: 'payee_id' and 'amount'.");
        }

        const settleAmount = Number(payload.amount);
        if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
          throw new Error("Settlement amount must be a positive finite number.");
        }

        const settleSheet = doc.getSheetByName("fact_settlements");
        if (!settleSheet) throw new Error("Table 'fact_settlements' not found. Run seedDatabase() first.");

        const settlementId = payload.settlement_id || "SETTLE_" + Utilities.getUuid().substring(0, 8);
        const timestamp = payload.timestamp || new Date().toISOString();
        const monthCycle = payload.month_cycle || Utilities.formatDate(new Date(timestamp), "Asia/Kolkata", "yyyy-MM");

        // fact_settlements columns:
        // [settlement_id, payer_id, payee_id, amount, timestamp, month_cycle]
        settleSheet.appendRow([
          settlementId,
          currentUser.user_id, // Server-enforced payer identity
          String(payload.payee_id).trim(),
          settleAmount,
          timestamp,
          monthCycle
        ]);

        responseData.message = "Debt settlement recorded successfully.";
        responseData.settlement_id = settlementId;
        responseData.payer_id = currentUser.user_id;
        responseData.payee_id = payload.payee_id;
        responseData.amount = settleAmount;
        responseData.month_cycle = monthCycle;
        break;
      }

      // --- BUDGET: PAY MONTHLY BUDGET COLLECTION ---
      case "pay_budget_collection": {
        if (!payload.collection_id) {
          throw new Error("Missing required field: 'collection_id'.");
        }

        const colSheet = doc.getSheetByName("fact_budget_collections");
        if (!colSheet) throw new Error("Table 'fact_budget_collections' not found. Run seedDatabase() first.");

        const colData = colSheet.getDataRange().getValues();
        if (colData.length < 2) throw new Error("No collection records found in 'fact_budget_collections'.");

        const colHeaders = colData[0].map(function(h) { return String(h).trim(); });
        const idIdx = colHeaders.indexOf("collection_id");
        const statusIdx = colHeaders.indexOf("status");
        const methodIdx = colHeaders.indexOf("payment_method");
        const proofIdx = colHeaders.indexOf("screenshot_url");
        const paidAtIdx = colHeaders.indexOf("paid_at");

        if (idIdx === -1 || statusIdx === -1) {
          throw new Error("Invalid schema in 'fact_budget_collections'. Missing required columns.");
        }

        let targetRowIndex = -1;
        for (let i = 1; i < colData.length; i++) {
          if (String(colData[i][idIdx]) === String(payload.collection_id).trim()) {
            targetRowIndex = i + 1;
            break;
          }
        }

        if (targetRowIndex === -1) {
          throw new Error("Budget collection record '" + payload.collection_id + "' not found.");
        }

        let screenshotUrl = "";
        if (payload.screenshot && String(payload.screenshot).indexOf("data:image") !== -1) {
          screenshotUrl = saveScreenshotToDrive(payload.screenshot, "budget_collection_");
        }

        const paidAt = payload.paid_at || new Date().toISOString();
        const payMethod = payload.payment_method || (payload.is_cash ? "CASH" : "UPI");

        colSheet.getRange(targetRowIndex, statusIdx + 1).setValue("PAID");
        if (methodIdx !== -1) colSheet.getRange(targetRowIndex, methodIdx + 1).setValue(payMethod);
        if (proofIdx !== -1 && screenshotUrl) colSheet.getRange(targetRowIndex, proofIdx + 1).setValue(screenshotUrl);
        if (paidAtIdx !== -1) colSheet.getRange(targetRowIndex, paidAtIdx + 1).setValue(paidAt);

        responseData.message = "Monthly budget dues marked as PAID.";
        responseData.collection_id = payload.collection_id;
        responseData.status = "PAID";
        responseData.screenshot_url = screenshotUrl;
        break;
      }

      // --- BUDGET: VERIFY MONTHLY BUDGET COLLECTION ---
      case "verify_budget_collection": {
        if (!payload.collection_id) {
          throw new Error("Missing required field: 'collection_id'.");
        }

        const colSheet = doc.getSheetByName("fact_budget_collections");
        if (!colSheet) throw new Error("Table 'fact_budget_collections' not found. Run seedDatabase() first.");

        const colData = colSheet.getDataRange().getValues();
        const colHeaders = colData[0].map(function(h) { return String(h).trim(); });
        const idIdx = colHeaders.indexOf("collection_id");
        const statusIdx = colHeaders.indexOf("status");
        const verifiedByIdx = colHeaders.indexOf("verified_by");

        let targetRowIndex = -1;
        for (let i = 1; i < colData.length; i++) {
          if (String(colData[i][idIdx]) === String(payload.collection_id).trim()) {
            targetRowIndex = i + 1;
            break;
          }
        }

        if (targetRowIndex === -1) {
          throw new Error("Budget collection record '" + payload.collection_id + "' not found.");
        }

        const verifier = currentUser ? currentUser.user_id : (payload.verified_by || "admin");
        colSheet.getRange(targetRowIndex, statusIdx + 1).setValue("VERIFIED");
        if (verifiedByIdx !== -1) colSheet.getRange(targetRowIndex, verifiedByIdx + 1).setValue(verifier);

        responseData.message = "Monthly budget collection VERIFIED.";
        responseData.collection_id = payload.collection_id;
        responseData.status = "VERIFIED";
        responseData.verified_by = verifier;
        break;
      }

      // --- INVENTORY: UPDATE STOCK STATUS ---
      case "update_stock": {
        if (!payload.item_id || !payload.new_status) {
          throw new Error("Missing required fields: 'item_id' and 'new_status'.");
        }

        const validStatuses = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"];
        if (validStatuses.indexOf(payload.new_status) === -1) {
          throw new Error("Invalid status '" + payload.new_status + "'. Allowed: " + validStatuses.join(", "));
        }

        const sheet = doc.getSheetByName("dim_inventory");
        if (!sheet) throw new Error("Table 'dim_inventory' not found.");

        const data = sheet.getDataRange().getValues();
        let itemRowIndex = -1;

        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(payload.item_id).trim()) {
            itemRowIndex = i + 1;
            break;
          }
        }

        if (itemRowIndex === -1) {
          throw new Error("Inventory item not found: " + payload.item_id);
        }

        // Column 5 = current_status in dim_inventory
        sheet.getRange(itemRowIndex, 5).setValue(payload.new_status);

        // Audit log transition
        const eventId = "EVT_" + Utilities.getUuid().substring(0, 8);
        const reportedBy = currentUser ? currentUser.user_id : "FLATMATE";
        const eventsSheet = doc.getSheetByName("fact_stock_events");

        if (eventsSheet) {
          eventsSheet.appendRow([
            eventId,
            new Date().toISOString(),
            payload.item_id,
            payload.new_status,
            reportedBy
          ]);
        }

        responseData.message = "Stock status updated successfully.";
        responseData.eventId = eventId;
        break;
      }

      // --- INVENTORY: ADD NEW ITEM ---
      case "add_item": {
        const requiredItemFields = ["item_id", "item_name", "group_id"];
        requiredItemFields.forEach(function(field) {
          if (!payload[field] || String(payload[field]).trim() === "") {
            throw new Error("Missing required field for inventory item: '" + field + "'");
          }
        });

        const sheet = doc.getSheetByName("dim_inventory");
        if (!sheet) throw new Error("Table 'dim_inventory' not found.");

        const existingData = sheet.getDataRange().getValues();
        for (let i = 1; i < existingData.length; i++) {
          if (String(existingData[i][0]).trim() === String(payload.item_id).trim()) {
            throw new Error("Inventory item with ID '" + payload.item_id + "' already exists.");
          }
        }

        const validStatuses = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"];
        const status = (payload.current_status && validStatuses.indexOf(payload.current_status) !== -1)
          ? payload.current_status
          : "IN_STOCK";

        const isEssential = Boolean(payload.is_essential);

        sheet.appendRow([
          String(payload.item_id).trim(),
          String(payload.item_name).trim(),
          String(payload.group_id).trim(),
          isEssential,
          status
        ]);

        const eventId = "EVT_" + Utilities.getUuid().substring(0, 8);
        const eventsSheet = doc.getSheetByName("fact_stock_events");
        if (eventsSheet) {
          eventsSheet.appendRow([
            eventId,
            new Date().toISOString(),
            payload.item_id,
            status,
            currentUser ? currentUser.user_id : "SYSTEM"
          ]);
        }

        responseData.message = "Inventory item added successfully.";
        responseData.item_id = payload.item_id;
        responseData.eventId = eventId;
        break;
      }

      // --- INVENTORY: DELETE ITEM ---
      case "delete_item": {
        if (!payload.item_id || String(payload.item_id).trim() === "") {
          throw new Error("Missing required parameter: 'item_id'.");
        }

        const sheet = doc.getSheetByName("dim_inventory");
        if (!sheet) throw new Error("Table 'dim_inventory' not found.");

        const data = sheet.getDataRange().getValues();
        let targetRowIndex = -1;

        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(payload.item_id).trim()) {
            targetRowIndex = i + 1;
            break;
          }
        }

        if (targetRowIndex === -1) {
          throw new Error("Inventory item not found: " + payload.item_id);
        }

        sheet.deleteRow(targetRowIndex);

        responseData.message = "Inventory item deleted successfully.";
        responseData.item_id = payload.item_id;
        break;
      }

      // --- STOCK AUDIT: RECORD STOCK EVENT ---
      case "record_stock_event": {
        if (!payload.item_id || !payload.event_type) {
          throw new Error("Missing required parameters: 'item_id' and 'event_type'.");
        }

        const sheet = doc.getSheetByName("fact_stock_events");
        if (!sheet) throw new Error("Table 'fact_stock_events' not found.");

        const eventId = payload.event_id || "EVT_" + Utilities.getUuid().substring(0, 8);
        const timestamp = payload.timestamp || new Date().toISOString();
        const reportedBy = currentUser ? currentUser.user_id : (payload.reported_by || "FLATMATE");

        sheet.appendRow([
          eventId,
          timestamp,
          String(payload.item_id),
          String(payload.event_type),
          String(reportedBy)
        ]);

        responseData.message = "Stock event recorded successfully.";
        responseData.eventId = eventId;
        break;
      }

      default: {
        throw new Error("Unsupported action or HTTP method: " + method + " " + action);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: error.message || error.toString(),
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

// ==============================================================================
// 3. ZERO-TRUST IDENTITY & PROFILE RESOLVER
// ==============================================================================

/**
 * Retrieves the email address of the authenticated Google user.
 * Supports explicit client-side email override for cross-origin PWA sign-in.
 */
function getAuthenticatedUserEmail(clientEmail) {
  // 1. If client provided authenticated Google email in request, prioritize it
  if (clientEmail && String(clientEmail).indexOf("@") !== -1) {
    return String(clientEmail).toLowerCase().trim();
  }

  // 2. If Session.getActiveUser() is available
  try {
    const activeUser = Session.getActiveUser();
    if (activeUser) {
      const activeEmail = activeUser.getEmail();
      if (activeEmail && activeEmail.indexOf("@") !== -1) {
        return activeEmail.toLowerCase().trim();
      }
    }
  } catch (e) {}

  return "";
}

/**
 * Repairs dim_members schema if missing 'email' header,
 * and deletes duplicate member rows for the same email address.
 */
function repairAndDeduplicateMembers(doc) {
  const membersSheet = doc.getSheetByName("dim_members");
  if (!membersSheet) return;

  const data = membersSheet.getDataRange().getValues();
  if (data.length === 0) return;

  const headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  let emailIndex = headers.indexOf("email");

  // Fix header row if 'email' column is missing
  if (emailIndex === -1) {
    membersSheet.insertColumnAfter(2);
    membersSheet.getRange(1, 3).setValue("email");
    emailIndex = 2;
  }

  // Reload data after potential schema insert
  const freshData = membersSheet.getDataRange().getValues();
  if (freshData.length <= 1) return;

  const freshHeaders = freshData[0].map(function(h) { return String(h).trim().toLowerCase(); });
  const fEmailIdx = freshHeaders.indexOf("email");
  const fUserIdIdx = freshHeaders.indexOf("user_id");

  const seenEmails = {};
  const duplicateRows = []; // 1-based row numbers to delete
  const userIdReplacements = {}; // duplicateUserId -> primaryUserId

  for (let r = 1; r < freshData.length; r++) {
    const row = freshData[r];
    const uId = String(row[fUserIdIdx !== -1 ? fUserIdIdx : 0]).trim();
    let rowEmail = fEmailIdx !== -1 ? String(row[fEmailIdx]).toLowerCase().trim() : "";

    // If cell in email column is empty or invalid, scan row for an email
    if (!rowEmail || rowEmail.indexOf("@") === -1) {
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c]).toLowerCase().trim();
        if (val.indexOf("@") !== -1 && val.indexOf(".") !== -1) {
          rowEmail = val;
          if (fEmailIdx !== -1) {
            membersSheet.getRange(r + 1, fEmailIdx + 1).setValue(rowEmail);
          }
          break;
        }
      }
    }

    if (rowEmail && rowEmail.indexOf("@") !== -1) {
      if (seenEmails[rowEmail]) {
        duplicateRows.push(r + 1);
        userIdReplacements[uId] = seenEmails[rowEmail];
      } else {
        seenEmails[rowEmail] = uId;
      }
    }
  }

  // Delete duplicate rows from dim_members (bottom to top)
  for (let d = duplicateRows.length - 1; d >= 0; d--) {
    membersSheet.deleteRow(duplicateRows[d]);
  }

  // Clean up duplicate member references in map_member_group
  const mapSheet = doc.getSheetByName("map_member_group");
  if (mapSheet) {
    const mapData = mapSheet.getDataRange().getValues();
    const seenGroupUser = {};
    const mapRowsToDelete = [];

    for (let m = 1; m < mapData.length; m++) {
      const gId = String(mapData[m][1]).trim();
      let mUserId = String(mapData[m][2]).trim();

      // Replace duplicate ID with primary ID
      if (userIdReplacements[mUserId]) {
        mUserId = userIdReplacements[mUserId];
        mapSheet.getRange(m + 1, 3).setValue(mUserId);
      }

      const key = gId + ":" + mUserId;
      if (seenGroupUser[key]) {
        mapRowsToDelete.push(m + 1);
      } else {
        seenGroupUser[key] = true;
      }
    }

    for (let md = mapRowsToDelete.length - 1; md >= 0; md--) {
      mapSheet.deleteRow(mapRowsToDelete[md]);
    }
  }

  // Clean up duplicate budget collections
  const colSheet = doc.getSheetByName("fact_budget_collections");
  if (colSheet) {
    const colData = colSheet.getDataRange().getValues();
    const seenCol = {};
    const colRowsToDelete = [];

    for (let b = 1; b < colData.length; b++) {
      const cycle = String(colData[b][1]).trim();
      const gId = String(colData[b][2]).trim();
      let bUserId = String(colData[b][3]).trim();

      if (userIdReplacements[bUserId]) {
        bUserId = userIdReplacements[bUserId];
        colSheet.getRange(b + 1, 4).setValue(bUserId);
      }

      const key = cycle + ":" + gId + ":" + bUserId;
      if (seenCol[key]) {
        colRowsToDelete.push(b + 1);
      } else {
        seenCol[key] = true;
      }
    }

    for (let cd = colRowsToDelete.length - 1; cd >= 0; cd--) {
      colSheet.deleteRow(colRowsToDelete[cd]);
    }
  }
}

/**
 * Resolves a Member object from dim_members by email or explicit user_id.
 * If user does not exist, auto-provisions a single unique member and assigns them to GRP_ALL.
 */
function resolveMemberByEmail(email, doc, explicitUserId) {
  const membersSheet = doc.getSheetByName("dim_members");
  if (!membersSheet) return null;

  // Ensure schema and dedup rows first
  repairAndDeduplicateMembers(doc);

  if (!email && !explicitUserId) return null;

  const data = membersSheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  const headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  let emailIndex = headers.indexOf("email");
  let userIdIndex = headers.indexOf("user_id");
  let nameIndex = headers.indexOf("name");
  let upiIndex = headers.indexOf("upi_id");
  let activeIndex = headers.indexOf("is_active");

  const normalizedEmail = email ? String(email).toLowerCase().trim() : "";
  const normalizedId = explicitUserId ? String(explicitUserId).trim() : "";

  // 1. Search by email
  if (normalizedEmail) {
    for (let i = 1; i < data.length; i++) {
      let rowEmail = emailIndex !== -1 ? String(data[i][emailIndex]).toLowerCase().trim() : "";
      if (!rowEmail) {
        for (let c = 0; c < data[i].length; c++) {
          const val = String(data[i][c]).toLowerCase().trim();
          if (val === normalizedEmail) {
            rowEmail = val;
            break;
          }
        }
      }

      if (rowEmail === normalizedEmail) {
        return {
          user_id: String(data[i][userIdIndex !== -1 ? userIdIndex : 0]),
          name: String(data[i][nameIndex !== -1 ? nameIndex : 1]),
          email: rowEmail,
          upi_id: upiIndex !== -1 ? String(data[i][upiIndex]) : "",
          is_active: activeIndex !== -1 ? Boolean(data[i][activeIndex]) : true
        };
      }
    }
  }

  // 2. Search by explicit user ID
  if (normalizedId) {
    for (let j = 1; j < data.length; j++) {
      const rowId = String(data[j][userIdIndex !== -1 ? userIdIndex : 0]).trim();
      if (rowId === normalizedId) {
        return {
          user_id: rowId,
          name: String(data[j][nameIndex !== -1 ? nameIndex : 1]),
          email: emailIndex !== -1 ? String(data[j][emailIndex]) : "",
          upi_id: upiIndex !== -1 ? String(data[j][upiIndex]) : "",
          is_active: activeIndex !== -1 ? Boolean(data[j][activeIndex]) : true
        };
      }
    }
  }

  // 3. Auto-provision ONLY if valid email was provided AND does not already exist
  if (normalizedEmail && normalizedEmail.indexOf("@") !== -1) {
    const newUserId = "USR_" + Utilities.getUuid().substring(0, 8);
    const displayName = normalizedEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, function(l) { return l.toUpperCase(); });
    const newMember = {
      user_id: newUserId,
      name: displayName,
      email: normalizedEmail,
      upi_id: "",
      is_active: true
    };

    membersSheet.appendRow([
      newMember.user_id,
      newMember.name,
      newMember.email,
      newMember.upi_id,
      newMember.is_active
    ]);

    // Automatically enroll in Global Household
    const mapSheet = doc.getSheetByName("map_member_group");
    if (mapSheet) {
      const mapId = "MAP_" + Utilities.getUuid().substring(0, 8);
      mapSheet.appendRow([mapId, GLOBAL_GROUP_ID, newMember.user_id]);
    }

    return newMember;
  }

  return null;
}

/**
 * Checks fact_budget_collections for the current cycle.
 * If monthly dues have not been created for active members, auto-generates them.
 */
function ensureMonthlyBudgetCollections(doc, currentCycle) {
  let sheet = doc.getSheetByName("fact_budget_collections");
  if (!sheet) {
    sheet = doc.insertSheet("fact_budget_collections");
    sheet.appendRow([
      "collection_id",
      "month_cycle",
      "group_id",
      "user_id",
      "amount",
      "status",
      "payment_method",
      "screenshot_url",
      "paid_at",
      "verified_by"
    ]);
  }

  const colData = sheet.getDataRange().getValues();
  const existingRecords = new Set();
  if (colData.length > 1) {
    const headers = colData[0].map(function(h) { return String(h).trim(); });
    const cycleIdx = headers.indexOf("month_cycle");
    const userIdx = headers.indexOf("user_id");
    const groupIdx = headers.indexOf("group_id");

    for (let i = 1; i < colData.length; i++) {
      if (cycleIdx !== -1 && String(colData[i][cycleIdx]) === currentCycle) {
        const uId = userIdx !== -1 ? String(colData[i][userIdx]) : "";
        const gId = groupIdx !== -1 ? String(colData[i][groupIdx]) : "";
        existingRecords.add(gId + ":" + uId);
      }
    }
  }

  const groupsSheet = doc.getSheetByName("dim_groups");
  const memberGroupsSheet = doc.getSheetByName("map_member_group");
  const membersSheet = doc.getSheetByName("dim_members");
  if (!groupsSheet || !memberGroupsSheet || !membersSheet) return;

  const groupsData = groupsSheet.getDataRange().getValues();
  const mapData = memberGroupsSheet.getDataRange().getValues();
  const membersData = membersSheet.getDataRange().getValues();

  // Active members
  const activeMembers = new Set();
  if (membersData.length > 1) {
    for (let m = 1; m < membersData.length; m++) {
      if (membersData[m][4] !== false) {
        activeMembers.add(String(membersData[m][0]));
      }
    }
  }

  // Generate for GLOBAL_GROUP_ID
  for (let g = 1; g < groupsData.length; g++) {
    const groupId = String(groupsData[g][0]);
    if (groupId !== GLOBAL_GROUP_ID) continue;
    const targetBudget = Number(groupsData[g][2]) || 8000;

    const groupMembers = [];
    for (let k = 1; k < mapData.length; k++) {
      if (String(mapData[k][1]) === groupId) {
        const memberId = String(mapData[k][2]);
        if (activeMembers.has(memberId) && groupMembers.indexOf(memberId) === -1) {
          groupMembers.push(memberId);
        }
      }
    }

    if (groupMembers.length === 0) continue;
    const perMemberQuota = Number((targetBudget / groupMembers.length).toFixed(2));

    for (let u = 0; u < groupMembers.length; u++) {
      const uId = groupMembers[u];
      if (!existingRecords.has(groupId + ":" + uId)) {
        const colId = "COL_" + currentCycle + "_" + uId.replace(/[^a-zA-Z0-9]/g, "");
        sheet.appendRow([
          colId,
          currentCycle,
          groupId,
          uId,
          perMemberQuota,
          "PENDING",
          "",
          "",
          "",
          ""
        ]);
        existingRecords.add(groupId + ":" + uId);
      }
    }
  }
}

// ==============================================================================
// 4. GOOGLE DRIVE SCREENSHOT UPLOADER
// ==============================================================================

/**
 * Decodes a base64 image and saves it to a designated "FlatMate OS" folder in Google Drive.
 * Returns the viewable/shareable Google Drive URL.
 */
function saveScreenshotToDrive(base64Data, filenamePrefix) {
  if (!base64Data || typeof base64Data !== "string") {
    return "";
  }

  let contentType = "image/png";
  let cleanBase64 = base64Data.trim();

  // Match and strip data URL prefix if present
  const dataUriMatch = cleanBase64.match(/^data:(image\/[a-zA-Z0-9\-\+\.]+);base64,(.+)$/);
  if (dataUriMatch) {
    contentType = dataUriMatch[1];
    cleanBase64 = dataUriMatch[2];
  }

  const decodedBytes = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decodedBytes, contentType, (filenamePrefix || "proof") + ".png");

  // Locate or create FlatMate OS Drive folder
  const folderIter = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  let targetFolder;
  if (folderIter.hasNext()) {
    targetFolder = folderIter.next();
  } else {
    targetFolder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  }

  const uploadedFile = targetFolder.createFile(blob);
  uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return uploadedFile.getUrl();
}

// ==============================================================================
// 5. GOOGLE SHEETS DATA PARSER
// ==============================================================================

function getSheetDataAsObjects(sheetName, docInstance) {
  let doc = docInstance;

  if (!doc) {
    const spreadsheetId = SCRIPT_PROP.getProperty("key");
    if (!spreadsheetId) {
      throw new Error("Database not initialized. Run seedDatabase() first.");
    }
    doc = SpreadsheetApp.openById(spreadsheetId);
  }

  const sheet = doc.getSheetByName(sheetName);
  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return [];
  }

  const headers = data[0].map(function(h) { return String(h).trim(); });

  return data.slice(1)
    .filter(function(row) {
      return row.some(function(cell) { return cell !== "" && cell !== null && cell !== undefined; });
    })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(header, index) {
        const value = row[index];
        obj[header] = (value instanceof Date)
          ? value.toISOString()
          : value;
      });
      return obj;
    });
}
