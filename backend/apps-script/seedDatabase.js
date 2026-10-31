/**
 * ==============================================================================
 * FlatMate OS - Database Schema Initialization & Seeder Script
 * File: backend/apps-script/seedDatabase.js
 * ==============================================================================
 * Relational Structure (8 Tables):
 * 1. dim_members           : Member roster with authenticated Google emails
 * 2. dim_groups            : Shared and subgroup budgeting pools
 * 3. map_member_group      : N:M relational mapping between members and groups
 * 4. dim_inventory         : Consumables catalog with priority flags
 * 5. fact_expense_logs     : Communal expense ledger with net-debt splits
 * 6. fact_stock_events     : Inventory transition audit logs
 * 7. fact_budget_requests  : Budget top-up requests with Google Drive proof URLs
 * 8. fact_settlements      : Settlement payment audit logs with billing cycles
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🏠 FlatMate OS")
    .addItem("⚡ Initialize / Reset Database Schema", "seedDatabase")
    .addToUi();
}

function seedDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProp = PropertiesService.getScriptProperties();

  // Save active Spreadsheet ID to Script Properties
  scriptProp.setProperty("key", ss.getId());

  // ----------------------------------------------------------------------------
  // 1. ENSURE GOOGLE DRIVE PROOF FOLDER EXISTS
  // ----------------------------------------------------------------------------
  const DRIVE_FOLDER_NAME = "FlatMate OS";
  const folderIter = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (!folderIter.hasNext()) {
    DriveApp.createFolder(DRIVE_FOLDER_NAME);
  }

  // ----------------------------------------------------------------------------
  // 2. SCHEMA DEFINITION FOR ALL 8 RELATIONAL TABLES
  // ----------------------------------------------------------------------------
  const SCHEMA = {
    dim_members: {
      headers: ["user_id", "name", "email", "upi_id", "is_active"],
      tabColor: "#2563EB"
    },
    dim_groups: {
      headers: ["group_id", "group_name", "budget_target"],
      tabColor: "#2563EB"
    },
    map_member_group: {
      headers: ["map_id", "group_id", "user_id"],
      tabColor: "#7C3AED"
    },
    dim_inventory: {
      headers: ["item_id", "item_name", "group_id", "is_essential", "current_status"],
      tabColor: "#2563EB"
    },
    fact_expense_logs: {
      headers: ["expense_id", "timestamp", "item_id", "group_id", "paid_by", "amount"],
      tabColor: "#059669"
    },
    fact_stock_events: {
      headers: ["event_id", "timestamp", "item_id", "event_type", "reported_by"],
      tabColor: "#059669"
    },
    fact_budget_requests: {
      headers: ["request_id", "group_id", "requested_by", "amount", "screenshot_url", "is_cash", "status"],
      tabColor: "#D97706"
    },
    fact_settlements: {
      headers: ["settlement_id", "payer_id", "payee_id", "amount", "timestamp", "month_cycle"],
      tabColor: "#059669"
    },
    fact_budget_collections: {
      headers: [
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
      ],
      tabColor: "#0284C7"
    }
  };

  const HEADER_BG_COLOR = "#0F172A"; // Slate 900
  const HEADER_FONT_COLOR = "#FFFFFF"; // Pure White
  const HEADER_FONT_FAMILY = "Inter";

  // Create or clean all 8 sheets
  for (const [sheetName, config] of Object.entries(SCHEMA)) {
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clearContents();
      sheet.clearFormats();
      sheet.getDataRange().clearDataValidations();
    }

    const headers = config.headers;
    const headerRange = sheet.getRange(1, 1, 1, headers.length);

    headerRange.setValues([headers]);
    headerRange.setBackground(HEADER_BG_COLOR);
    headerRange.setFontColor(HEADER_FONT_COLOR);
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);
    headerRange.setFontFamily(HEADER_FONT_FAMILY);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");

    sheet.setRowHeight(1, 36);
    sheet.setFrozenRows(1);
    sheet.setTabColor(config.tabColor);
  }

  // Remove default sheet if present
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > Object.keys(SCHEMA).length) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }

  // ----------------------------------------------------------------------------
  // 3. SEED DIM_MEMBERS (WITH GOOGLE EMAILS)
  // ----------------------------------------------------------------------------
  const activeEmail = Session.getActiveUser().getEmail() || "";
  const membersSheet = ss.getSheetByName("dim_members");
  const membersData = [
    ["USR_01", "Siddharth", activeEmail ? activeEmail.toLowerCase() : "siddharth@gmail.com", "siddharth@ybl", true],
    ["USR_02", "Rahul", "rahul@gmail.com", "rahul@okhdfcbank", true],
    ["USR_03", "Amit", "amit@gmail.com", "amit@icici", true],
    ["USR_04", "Vikram", "vikram@paytm", true] // will auto-match email if logged in as Vikram
  ];
  // Ensure 5 columns
  const normalizedMembers = membersData.map(function(row) {
    if (row.length === 4) {
      // row format [id, name, upi, active] -> [id, name, email, upi, active]
      return [row[0], row[1], row[1].toLowerCase() + "@gmail.com", row[2], row[3]];
    }
    return row;
  });
  membersSheet.getRange(2, 1, normalizedMembers.length, 5).setValues(normalizedMembers);

  // ----------------------------------------------------------------------------
  // 4. SEED DIM_GROUPS
  // ----------------------------------------------------------------------------
  const groupsSheet = ss.getSheetByName("dim_groups");
  const groupsData = [
    ["GRP_ALL", "Global Household", 10000],
    ["GRP_VEG", "Vegetarian Staples", 4000],
    ["GRP_NONVEG", "Non-Veg Pool", 3000],
    ["GRP_TEA", "Chai Lovers", 1000]
  ];
  groupsSheet.getRange(2, 1, groupsData.length, 3).setValues(groupsData);
  groupsSheet.getRange(2, 3, groupsData.length, 1).setNumberFormat("₹#,##0.00");

  // ----------------------------------------------------------------------------
  // 5. SEED MAP_MEMBER_GROUP
  // ----------------------------------------------------------------------------
  const mapSheet = ss.getSheetByName("map_member_group");
  const mapData = [
    // Everyone in Global Household
    ["MAP_1", "GRP_ALL", "USR_01"],
    ["MAP_2", "GRP_ALL", "USR_02"],
    ["MAP_3", "GRP_ALL", "USR_03"],
    ["MAP_4", "GRP_ALL", "USR_04"],
    // Vegetarian Staples (Amit & Rahul)
    ["MAP_5", "GRP_VEG", "USR_02"],
    ["MAP_6", "GRP_VEG", "USR_03"],
    // Non-Veg Pool (Amit & Vikram)
    ["MAP_7", "GRP_NONVEG", "USR_03"],
    ["MAP_8", "GRP_NONVEG", "USR_04"],
    // Chai Lovers (Siddharth, Rahul, Vikram)
    ["MAP_9", "GRP_TEA", "USR_01"],
    ["MAP_10", "GRP_TEA", "USR_02"],
    ["MAP_11", "GRP_TEA", "USR_04"]
  ];
  mapSheet.getRange(2, 1, mapData.length, 3).setValues(mapData);

  // ----------------------------------------------------------------------------
  // 6. SEED DIM_INVENTORY
  // ----------------------------------------------------------------------------
  const invSheet = ss.getSheetByName("dim_inventory");
  const invData = [
    ["ITM_01", "Cooking Oil (1L)", "GRP_ALL", true, "LOW_STOCK"],
    ["ITM_02", "Dishwash Liquid", "GRP_ALL", true, "OUT_OF_STOCK"],
    ["ITM_03", "Eggs (1 Dozen)", "GRP_NONVEG", false, "IN_STOCK"],
    ["ITM_04", "Basmati Rice (5kg)", "GRP_ALL", true, "IN_STOCK"],
    ["ITM_05", "Chicken (1kg)", "GRP_NONVEG", false, "OUT_OF_STOCK"],
    ["ITM_06", "Toor Dal (1kg)", "GRP_VEG", true, "LOW_STOCK"],
    ["ITM_07", "Tata Tea Gold", "GRP_TEA", true, "OUT_OF_STOCK"],
    ["ITM_08", "Milk (1L)", "GRP_ALL", true, "LOW_STOCK"],
    ["ITM_09", "Garbage Bags", "GRP_ALL", true, "IN_STOCK"],
    ["ITM_10", "Maggi (6 Pack)", "GRP_ALL", false, "IN_STOCK"]
  ];
  invSheet.getRange(2, 1, invData.length, 5).setValues(invData);

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"], true)
    .setAllowInvalid(false)
    .build();
  invSheet.getRange(2, 5, 100, 1).setDataValidation(statusRule);

  // ----------------------------------------------------------------------------
  // 7. SEED FACT_EXPENSE_LOGS (PARTITIONED ACROSS CYCLES)
  // ----------------------------------------------------------------------------
  const expSheet = ss.getSheetByName("fact_expense_logs");
  const now = new Date();
  const currentTimestamp = now.toISOString();
  // 35 days ago (previous cycle)
  const pastCycleDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

  // Stored amount reflects Amount_Owed = Total - (Total / Strength)
  // E.g. ₹1500 for 4 members -> ₹1500 - (1500 / 4) = ₹1125.00
  const expData = [
    ["EXP_001", pastCycleDate, "Dmart Grocery Run", "GRP_ALL", "USR_01", 1125.00],
    ["EXP_002", pastCycleDate, "Chicken & Eggs", "GRP_NONVEG", "USR_03", 225.00],
    ["EXP_003", currentTimestamp, "Milk & Bread", "GRP_ALL", "USR_02", 90.00],
    ["EXP_004", currentTimestamp, "Tata Tea Gold", "GRP_TEA", "USR_04", 100.00]
  ];
  expSheet.getRange(2, 1, expData.length, 6).setValues(expData);
  expSheet.getRange(2, 6, expData.length, 1).setNumberFormat("₹#,##0.00");

  // ----------------------------------------------------------------------------
  // 8. SEED FACT_STOCK_EVENTS
  // ----------------------------------------------------------------------------
  const eventsSheet = ss.getSheetByName("fact_stock_events");
  const eventsData = [
    ["EVT_001", pastCycleDate, "ITM_02", "OUT_OF_STOCK", "USR_01"],
    ["EVT_002", currentTimestamp, "ITM_07", "OUT_OF_STOCK", "USR_04"],
    ["EVT_003", currentTimestamp, "ITM_01", "LOW_STOCK", "USR_02"]
  ];
  eventsSheet.getRange(2, 1, eventsData.length, 5).setValues(eventsData);

  // ----------------------------------------------------------------------------
  // 9. SEED FACT_BUDGET_REQUESTS
  // ----------------------------------------------------------------------------
  const budgetReqSheet = ss.getSheetByName("fact_budget_requests");
  const budgetReqData = [
    ["REQ_001", "GRP_ALL", "USR_01", 2000.00, "", false, "APPROVED"],
    ["REQ_002", "GRP_NONVEG", "USR_03", 500.00, "", true, "PENDING"]
  ];
  budgetReqSheet.getRange(2, 1, budgetReqData.length, 7).setValues(budgetReqData);
  budgetReqSheet.getRange(2, 4, budgetReqData.length, 1).setNumberFormat("₹#,##0.00");

  const budgetStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["PENDING", "APPROVED", "REJECTED"], true)
    .setAllowInvalid(false)
    .build();
  budgetReqSheet.getRange(2, 7, 100, 1).setDataValidation(budgetStatusRule);

  // ----------------------------------------------------------------------------
  // 10. SEED FACT_SETTLEMENTS (WITH MONTH_CYCLE)
  // ----------------------------------------------------------------------------
  const settleSheet = ss.getSheetByName("fact_settlements");
  const pastCycleStr = Utilities.formatDate(new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000), "Asia/Kolkata", "yyyy-MM");
  const currentCycleStr = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM");

  const settleData = [
    ["SETTLE_001", "USR_02", "USR_01", 385.00, pastCycleDate, pastCycleStr],
    ["SETTLE_002", "USR_03", "USR_01", 125.00, currentTimestamp, currentCycleStr]
  ];
  settleSheet.getRange(2, 1, settleData.length, 6).setValues(settleData);
  settleSheet.getRange(2, 4, settleData.length, 1).setNumberFormat("₹#,##0.00");

  // ----------------------------------------------------------------------------
  // 11. SEED FACT_BUDGET_COLLECTIONS (MONTHLY FIXED DUES)
  // ----------------------------------------------------------------------------
  const colSheet = ss.getSheetByName("fact_budget_collections");
  const colData = [
    ["COL_" + currentCycleStr + "_USR_01", currentCycleStr, "GRP_ALL", "USR_01", 2500.00, "VERIFIED", "UPI", "", currentTimestamp, "USR_02"],
    ["COL_" + currentCycleStr + "_USR_02", currentCycleStr, "GRP_ALL", "USR_02", 2500.00, "PAID", "UPI", "", currentTimestamp, ""],
    ["COL_" + currentCycleStr + "_USR_03", currentCycleStr, "GRP_ALL", "USR_03", 2500.00, "PENDING", "", "", "", ""],
    ["COL_" + currentCycleStr + "_USR_04", currentCycleStr, "GRP_ALL", "USR_04", 2500.00, "PENDING", "", "", "", ""]
  ];
  colSheet.getRange(2, 1, colData.length, 10).setValues(colData);
  colSheet.getRange(2, 5, colData.length, 1).setNumberFormat("₹#,##0.00");

  const colStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["PENDING", "PAID", "VERIFIED"], true)
    .setAllowInvalid(false)
    .build();
  colSheet.getRange(2, 6, 100, 1).setDataValidation(colStatusRule);

  // ----------------------------------------------------------------------------
  // 12. AUTO-RESIZE COLUMNS
  // ----------------------------------------------------------------------------
  for (const sheetName of Object.keys(SCHEMA)) {
    const s = ss.getSheetByName(sheetName);
    if (s) {
      s.autoResizeColumns(1, SCHEMA[sheetName].headers.length);
    }
  }

  try {
    SpreadsheetApp.getUi().alert(
      "✅ FlatMate OS 8-Table Database Initialized!\n\n" +
      "• 8 Relational tables created with bold headers & frozen rows.\n" +
      "• Zero-Trust member emails configured for active user.\n" +
      "• fact_budget_requests and fact_settlements ready.\n" +
      "• 'FlatMate OS' Google Drive folder verified.\n\n" +
      "Spreadsheet ID: " + ss.getId()
    );
  } catch (e) {
    Logger.log("Database initialized successfully for ID: " + ss.getId());
  }
}
