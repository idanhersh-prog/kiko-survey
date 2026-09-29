const SPREADSHEET_ID = '144NhTC38silrIk2e7c-WnI5e7fxQPgUPSEAd52vetjM';
const SHEET_NAME = 'Responses';

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'KIKO Survey' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const raw = (e && e.parameter && e.parameter.payload)
      ? e.parameter.payload
      : (e && e.postData && e.postData.contents ? e.postData.contents : '{}');

    const data = JSON.parse(raw || '{}');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) throw new Error('Responses sheet not found');

    const submissionId = Utilities.getUuid();
    const submittedAt = new Date();

    const join = (value) => Array.isArray(value) ? value.join(' | ') : (value ?? '');

    sheet.appendRow([
      submissionId,
      submittedAt,
      data.survey_version || 'v1',
      data.child_name || '',
      data.age_range || '',
      data.respondent_role || '',
      data.new_texture_response || '',
      join(data.sensory_preferences),
      data.context || '',
      data.initiation || '',
      join(data.parts_tested),
      data.best_part || '',
      join(data.best_part_reasons),
      data.less_part || '',
      join(data.less_part_reasons),
      join(data.observed_behaviors),
      data.initiative_score || '',
      data.cooperation_score || '',
      join(data.adult_response),
      data.engagement_score || '',
      data.use_again || '',
      data.feedback_text || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, submission_id: submissionId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
