// Match the database's ASCII whitespace normalization; preserve matric punctuation.
export const normalizeMatric = value => String(value || '').replace(/[ \t\r\n\f\v]/g, '').toUpperCase();
