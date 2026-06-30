const AUTOMATION = {
  repository: "ferment-you8mate-create/you-mate-recipes-",
  branch: "main",
  recipeFile: "recipes.js",
  responseSheet: "フォームの回答 1",
  statusHeader: "公開ステータス",
  autoPublishProperty: "AUTO_PUBLISH",
  tokenProperty: "GITHUB_TOKEN"
};

const FORM_HEADERS = {
  timestamp: "タイムスタンプ",
  email: "メールアドレス",
  name: "名前",
  handle: "ディスコード名",
  title: "レシピ名（必須）",
  type: "レシピの種類（必須）",
  materials: "材料（必須）",
  steps: "作り方（必須）",
  point: "ポイント・コツ",
  photos: "写真（できれば）",
  familyComment: "家族などの感想"
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("レシピ自動連携")
    .addItem("初期設定・トリガー作成", "installAutomation")
    .addItem("GitHub接続を確認", "verifyGithubConnection")
    .addSeparator()
    .addItem("自動公開にする", "enableAutoPublish")
    .addItem("承認制にする", "enableApprovalMode")
    .addSeparator()
    .addItem("選択中の行を公開", "publishActiveRow")
    .addItem("最新行を公開", "publishLatestRow")
    .addToUi();
}

function installAutomation() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(AUTOMATION.responseSheet);

  if (!sheet) {
    throw new Error("回答シートが見つかりません: " + AUTOMATION.responseSheet);
  }

  verifyGithubConnection();
  ensureStatusColumn_(sheet);
  removeAutomationTriggers_();

  ScriptApp.newTrigger("handleFormSubmit")
    .forSpreadsheet(spreadsheet)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger("handleApprovalEdit")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty(AUTOMATION.autoPublishProperty)) {
    properties.setProperty(AUTOMATION.autoPublishProperty, "true");
  }

  spreadsheet.toast("自動投稿トリガーを設定しました。", "レシピ自動連携");
}

function verifyGithubConnection() {
  const token = PropertiesService.getScriptProperties().getProperty(AUTOMATION.tokenProperty);
  if (!token) {
    throw new Error("スクリプトプロパティ GITHUB_TOKEN が未設定です。");
  }

  const url = "https://api.github.com/repos/" + AUTOMATION.repository;
  const repository = githubRequest_(url, {
    method: "get",
    headers: githubHeaders_(token)
  });

  if (repository.full_name !== AUTOMATION.repository) {
    throw new Error("接続先リポジトリが一致しません。");
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "GitHubへの接続を確認しました。",
    AUTOMATION.repository
  );
}

function handleFormSubmit(event) {
  if (!event || !event.range) {
    throw new Error("フォーム送信イベントから実行してください。");
  }

  const sheet = event.range.getSheet();
  if (sheet.getName() !== AUTOMATION.responseSheet) return;

  const row = event.range.getRow();
  if (isAutoPublishEnabled_()) {
    publishSheetRow_(sheet, row);
  } else {
    setStatus_(sheet, row, "承認待ち");
  }
}

function handleApprovalEdit(event) {
  if (!event || !event.range || isAutoPublishEnabled_()) return;

  const sheet = event.range.getSheet();
  if (sheet.getName() !== AUTOMATION.responseSheet || event.range.getRow() === 1) return;

  const statusColumn = ensureStatusColumn_(sheet);
  if (event.range.getColumn() !== statusColumn) return;

  if (String(event.value || "").trim() === "承認") {
    publishSheetRow_(sheet, event.range.getRow());
  }
}

function publishActiveRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== AUTOMATION.responseSheet) {
    throw new Error("フォームの回答シートで実行してください。");
  }

  publishSheetRow_(sheet, sheet.getActiveRange().getRow());
}

function publishLatestRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUTOMATION.responseSheet);
  publishSheetRow_(sheet, sheet.getLastRow());
}

function enableAutoPublish() {
  PropertiesService.getScriptProperties().setProperty(AUTOMATION.autoPublishProperty, "true");
  SpreadsheetApp.getActiveSpreadsheet().toast("新しい投稿は自動公開されます。", "自動公開 ON");
}

function enableApprovalMode() {
  PropertiesService.getScriptProperties().setProperty(AUTOMATION.autoPublishProperty, "false");
  SpreadsheetApp.getActiveSpreadsheet().toast("承認された投稿だけ公開されます。", "承認制 ON");
}

function publishSheetRow_(sheet, row) {
  if (!sheet || row <= 1) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("別のレシピを処理中です。少し待って再実行してください。");
  }

  try {
    setStatus_(sheet, row, "公開処理中");
    const values = readRow_(sheet, row);
    const recipe = buildRecipe_(values);
    const result = appendRecipeToGithub_(recipe);

    if (result.duplicate) {
      setStatus_(sheet, row, "公開済み（重複なし）");
    } else {
      setStatus_(sheet, row, "公開済み " + result.commit.substring(0, 7));
    }
  } catch (error) {
    setStatus_(sheet, row, "エラー: " + String(error.message || error).substring(0, 120));
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function readRow_(sheet, row) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const rowRange = sheet.getRange(row, 1, 1, lastColumn);
  const values = rowRange.getDisplayValues()[0];
  const richTextValues = rowRange.getRichTextValues()[0];
  const record = {};

  headers.forEach(function(header, index) {
    const normalizedHeader = String(header).trim();
    const links = extractRichTextLinks_(richTextValues[index]);
    record[normalizedHeader] = [values[index] || "", links.join(" ")]
      .filter(Boolean)
      .join(" ");
  });

  return record;
}

function extractRichTextLinks_(richTextValue) {
  if (!richTextValue) return [];
  const links = [];

  richTextValue.getRuns().forEach(function(run) {
    addUnique_(links, run.getLinkUrl());
  });

  addUnique_(links, richTextValue.getLinkUrl());
  return links.filter(Boolean);
}

function buildRecipe_(record) {
  const title = required_(record[FORM_HEADERS.title], FORM_HEADERS.title);
  const name = required_(record[FORM_HEADERS.name], FORM_HEADERS.name);
  const materials = required_(record[FORM_HEADERS.materials], FORM_HEADERS.materials);
  const steps = required_(record[FORM_HEADERS.steps], FORM_HEADERS.steps);
  const type = String(record[FORM_HEADERS.type] || "").trim();
  const point = String(record[FORM_HEADERS.point] || "").trim();
  const familyComment = String(record[FORM_HEADERS.familyComment] || "").trim();
  const imageIds = extractDriveIds_(record[FORM_HEADERS.photos]);
  const searchableText = [title, type, materials, steps, point].join(" ");
  const ferment = detectFerments_(searchableText);
  const labels = detectLabels_(searchableText, type, ferment);
  const timestamp = String(record[FORM_HEADERS.timestamp] || "");
  const email = String(record[FORM_HEADERS.email] || "");

  makeImagesPublic_(imageIds);

  return {
    sourceId: makeSourceId_([timestamp, email, name, title].join("|")),
    sourceTimestamp: timestamp,
    name: name,
    creatorHandle: String(record[FORM_HEADERS.handle] || "").trim(),
    title: title,
    ferment: ferment.join("、") || "発酵調味料",
    category: mapCategory_(type),
    labels: labels,
    materials: materials,
    steps: steps,
    point: point || familyComment || "講座生から届いたアレンジレシピです。",
    familyComment: familyComment,
    consent: "フォームから自動掲載",
    imageId: imageIds[0] || "",
    imageIds: imageIds
  };
}

function appendRecipeToGithub_(recipe) {
  const token = PropertiesService.getScriptProperties().getProperty(AUTOMATION.tokenProperty);
  if (!token) {
    throw new Error("スクリプトプロパティ GITHUB_TOKEN が未設定です。");
  }

  const apiUrl = "https://api.github.com/repos/" + AUTOMATION.repository +
    "/contents/" + AUTOMATION.recipeFile + "?ref=" + encodeURIComponent(AUTOMATION.branch);
  const headers = githubHeaders_(token);
  const current = githubRequest_(apiUrl, { method: "get", headers: headers });
  const content = Utilities.newBlob(
    Utilities.base64Decode(String(current.content).replace(/\s/g, ""))
  ).getDataAsString("UTF-8");

  if (content.indexOf(recipe.sourceId) !== -1 || containsLegacyRecipe_(content, recipe)) {
    return { duplicate: true, commit: "" };
  }

  if (!/\n\];\s*$/.test(content)) {
    throw new Error("recipes.js の末尾形式を確認できませんでした。");
  }

  const serialized = JSON.stringify(recipe, null, 2)
    .split("\n")
    .map(function(line) { return "  " + line; })
    .join("\n");
  const updated = content.replace(/\n\];\s*$/, ",\n" + serialized + "\n];\n");
  const payload = {
    message: "Auto publish recipe: " + recipe.title,
    content: Utilities.base64Encode(updated, Utilities.Charset.UTF_8),
    sha: current.sha,
    branch: AUTOMATION.branch
  };
  const response = githubRequest_(apiUrl, {
    method: "put",
    headers: headers,
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });

  return {
    duplicate: false,
    commit: response.commit && response.commit.sha ? response.commit.sha : ""
  };
}

function containsLegacyRecipe_(content, recipe) {
  const title = JSON.stringify(recipe.title);
  const name = JSON.stringify(recipe.name);
  const hasTitle = content.indexOf("title: " + title) !== -1 ||
    content.indexOf('"title": ' + title) !== -1;
  const hasName = content.indexOf("name: " + name) !== -1 ||
    content.indexOf('"name": ' + name) !== -1;
  return hasTitle && hasName;
}

function githubRequest_(url, options) {
  const requestOptions = Object.assign({ muteHttpExceptions: true }, options);
  const response = UrlFetchApp.fetch(url, requestOptions);
  const status = response.getResponseCode();
  const text = response.getContentText();
  const body = text ? JSON.parse(text) : {};

  if (status < 200 || status >= 300) {
    throw new Error("GitHub API " + status + ": " + (body.message || text));
  }

  return body;
}

function githubHeaders_(token) {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function detectFerments_(text) {
  const candidates = [
    "塩麹", "醤油麹", "玉ねぎ麹", "生姜麹", "にんにく麹",
    "甘麹", "甘酒", "酒粕", "赤みそ", "白みそ", "味噌",
    "りんご酢", "酢麹", "納豆", "キムチ", "ヨーグルト"
  ];
  return candidates.filter(function(item) { return text.indexOf(item) !== -1; });
}

function detectLabels_(text, type, ferments) {
  const labels = [];
  const category = mapCategory_(type);

  addUnique_(labels, category === "main" ? "主菜" :
    category === "sweets" ? "デザート" :
    category === "drink" ? "飲み物" : (type || "副菜"));

  const groups = [
    ["肉", /鶏|豚|牛|ひき肉|挽き肉|ベーコン|ハム|肉/],
    ["魚", /魚|さば|鯖|鮭|サーモン|まぐろ|マグロ|かじき|カジキ|ちくわ|海老|えび|いか|たこ/],
    ["野菜", /野菜|玉ねぎ|人参|にんじん|キャベツ|きゅうり|胡瓜|なす|茄子|ピーマン|水菜|ブロッコリー|インゲン|かぼちゃ|大葉|アボカド|トマト|にら|しめじ|しいたけ|えのき/],
    ["スープ", /スープ|汁|ポタージュ/],
    ["サラダ", /サラダ|ドレッシング/],
    ["前菜", /前菜|和え|カルパッチョ/],
    ["卵", /卵|たまご/],
    ["乳製品", /牛乳|生クリーム|クリームチーズ|チーズ|バター|ヨーグルト/],
    ["豆", /豆|豆乳|納豆/],
    ["米粉", /米粉/],
    ["果物", /いちご|苺|りんご|林檎|レモン|柚子|バナナ|果物|フルーツ/],
    ["ナッツ", /ナッツ|アーモンド|くるみ|カシューナッツ/],
    ["ドレッシング", /ドレッシング/]
  ];

  groups.forEach(function(group) {
    if (group[1].test(text)) addUnique_(labels, group[0]);
  });
  ferments.forEach(function(item) { addUnique_(labels, item); });

  return labels.slice(0, 10);
}

function mapCategory_(type) {
  const value = String(type || "");
  if (/主菜|メイン/.test(value)) return "main";
  if (/おやつ|デザート|甘味|スイーツ/.test(value)) return "sweets";
  if (/飲み物|ドリンク/.test(value)) return "drink";
  return "side";
}

function extractDriveIds_(value) {
  const text = String(value || "");
  const ids = [];
  const patterns = [
    /[?&]id=([a-zA-Z0-9_-]{20,})/g,
    /\/d\/([a-zA-Z0-9_-]{20,})/g
  ];

  patterns.forEach(function(pattern) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      addUnique_(ids, match[1]);
    }
  });

  return ids;
}

function makeImagesPublic_(imageIds) {
  imageIds.forEach(function(id) {
    try {
      DriveApp.getFileById(id).setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW
      );
    } catch (error) {
      console.warn("画像の共有設定を変更できませんでした: " + id + " / " + error);
    }
  });
}

function makeSourceId_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  ).map(function(byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ("0" + normalized.toString(16)).slice(-2);
  }).join("").substring(0, 24);
}

function ensureStatusColumn_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const existingIndex = headers.indexOf(AUTOMATION.statusHeader);
  if (existingIndex !== -1) return existingIndex + 1;

  const newColumn = lastColumn + 1;
  sheet.getRange(1, newColumn).setValue(AUTOMATION.statusHeader);
  return newColumn;
}

function setStatus_(sheet, row, value) {
  sheet.getRange(row, ensureStatusColumn_(sheet)).setValue(value);
}

function removeAutomationTriggers_() {
  const handlers = ["handleFormSubmit", "handleApprovalEdit"];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function isAutoPublishEnabled_() {
  return PropertiesService.getScriptProperties()
    .getProperty(AUTOMATION.autoPublishProperty) !== "false";
}

function required_(value, fieldName) {
  const text = String(value || "").trim();
  if (!text) throw new Error("必須項目が空です: " + fieldName);
  return text;
}

function addUnique_(items, value) {
  if (value && items.indexOf(value) === -1) items.push(value);
}
