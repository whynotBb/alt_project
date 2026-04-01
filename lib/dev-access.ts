/**
 * 개발 중에는 보안 게이트를 건너뜁니다. 운영 배포 전 반드시 false 로 두세요.
 */
export function isOpenAccessDev(): boolean {
  return process.env.OPEN_ACCESS_DEV === "true";
}
