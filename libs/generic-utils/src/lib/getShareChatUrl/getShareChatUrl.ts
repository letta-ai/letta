export function getShareChatUrl(chatId: string) {
  return `${process.env.NEXT_PUBLIC_CURRENT_HOST}/chat/${chatId}`;
}
