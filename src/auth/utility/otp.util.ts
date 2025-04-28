export const generateOtp = (): string => {
  const random1 = Math.floor(Math.random() * 900000);
  const random2 = Math.floor(Math.random() * 900000);
  const random3 = Math.floor(Math.random() * 900000);

  let otpNumber = (random1 * random2 + random3) % 1000000;

  if (otpNumber < 100000) {
    otpNumber += 100000;
  }

  return otpNumber.toString();
};
