export function getLaunchLinkUrl(link: string) {
  return `${process.env.NEXT_PUBLIC_CURRENT_HOST}/launch/${link}`;
}
