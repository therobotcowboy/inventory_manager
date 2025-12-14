export const APP_VERSION = "v5.1.0";
export const SPRINT_NAME = "Sprint 6";
export const BUILD_ID = new Date().toISOString().split('T')[0] + "-PROD"; // e.g. 2024-12-14-PROD

export const APP_METADATA = {
    version: APP_VERSION,
    sprint: SPRINT_NAME,
    buildId: BUILD_ID,
    fullVersion: `${APP_VERSION} (${SPRINT_NAME})`
};
