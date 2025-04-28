export const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split('@');
  const maskedLocalPart =
    localPart.substring(0, 3) + '***' + localPart.slice(-1);
  return `${maskedLocalPart}@${domain}`;
};
