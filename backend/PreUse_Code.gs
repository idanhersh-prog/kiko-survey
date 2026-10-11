const SPREADSHEET_ID = '1mKYM60vZrh2Mg80Km6KhabHLXUDKE-Nk_oIWTlNF_4Q';
const SHEET_NAME = 'Recommendations';

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      service: 'KIKO Pre-Use'
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const raw =
      (e && e.parameter && e.parameter.payload)
        ? e.parameter.payload
        : (
            e &&
            e.postData &&
            e.postData.contents
              ? e.postData.contents
              : '{}'
          );

    const d = JSON.parse(raw || '{}');

    const sh = SpreadsheetApp
      .openById(SPREADSHEET_ID)
      .getSheetByName(SHEET_NAME);

    if (!sh) {
      throw new Error('Recommendations sheet not found');
    }

    const join = v =>
      Array.isArray(v)
        ? v.join(' | ')
        : (v ?? '');

    sh.appendRow([
      Utilities.getUuid(),                              // A  submission_id
      new Date(),                                       // B  submitted_at
      'pre-v2',                                         // C  survey_version
      d.order_code || '',                               // D  order_code
      d.child_alias || '',                              // E  child_alias
      d.age_range || '',                                // F  age_range
      d.respondent_role || '',                          // G  respondent_role
      join(d.primary_goal),                             // H  primary_goal
      d.new_place_response || '',                       // I  new_place_response
      join(d.preferred_sensations),                     // J  preferred_sensations
      join(d.avoid_sensations),                         // K  avoid_sensations
      join(d.preferred_actions),                        // L  preferred_actions

      (d.recommended_parts || [])[0] || '',             // M  recommended_part_1
      (d.recommended_parts || [])[1] || '',             // N  recommended_part_2
      (d.recommended_parts || [])[2] || '',             // O  recommended_part_3

      (d.recommendation_reasons || [])[0] || '',        // P  recommendation_reason_1
      (d.recommendation_reasons || [])[1] || '',        // Q  recommendation_reason_2
      (d.recommendation_reasons || [])[2] || '',        // R  recommendation_reason_3

      (d.final_parts || [])[0] || '',                   // S  final_part_1
      (d.final_parts || [])[1] || '',                   // T  final_part_2
      (d.final_parts || [])[2] || '',                   // U  final_part_3

      d.user_changes ? 'yes' : 'no',                    // V  user_changes
      d.order_status || 'confirmed',                    // W  order_status
      d.confirmed_at
        ? new Date(d.confirmed_at)
        : new Date(),                                   // X  confirmed_at
      d.kiko_name || '',                                // Y  kiko_name
      d.character_color || ''                           // Z  character_color
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({
        ok: true,
        order_code: d.order_code || '',
        character_color: d.character_color || '',
        kiko_name: d.kiko_name || ''
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        ok: false,
        error: String(err)
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}
