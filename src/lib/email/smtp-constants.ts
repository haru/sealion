/**
 * Sentinel value used on the client side to indicate "keep the existing
 * stored SMTP password" without transmitting or displaying the real password.
 *
 * When the server receives this value in a PUT or POST request, it resolves
 * the actual password from the encrypted value stored in the database.
 */
export const SMTP_DUMMY_PASSWORD = "__SEALION_DUMMY_SMTP_PASSWORD__";
