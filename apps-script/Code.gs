// Google Apps Script веб-хук для приёма данных из игры «Калибровка».
// Установка: см. README.md в корне проекта, раздел «Сбор данных».

var ANSWERS_SHEET = 'answers';
var SUMMARY_SHEET = 'summary';
var STARTS_SHEET = 'starts';

var ANSWERS_HEADERS = [
  'ts', 'sessionId', 'playerId', 'lang', 'questionId', 'category',
  'sliderValue', 'confidence', 'guessTrue', 'actualTrue', 'correct', 'abstain', 'points',
];
var SUMMARY_HEADERS = [
  'ts', 'sessionId', 'playerId', 'lang', 'accuracy', 'calibrationScore', 'archetype', 'meanConfidence',
];
var STARTS_HEADERS = ['ts', 'sessionId', 'playerId', 'lang'];

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (data.type === 'answer') {
    appendRow(ss, ANSWERS_SHEET, ANSWERS_HEADERS, data);
  } else if (data.type === 'summary') {
    appendRow(ss, SUMMARY_SHEET, SUMMARY_HEADERS, data);
  } else if (data.type === 'start') {
    appendRow(ss, STARTS_SHEET, STARTS_HEADERS, data);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function appendRow(ss, sheetName, headers, data) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  }
  var row = headers.map(function (key) {
    var val = data[key];
    if (val === undefined || val === null) return '';
    return val;
  });
  sheet.appendRow(row);
}
