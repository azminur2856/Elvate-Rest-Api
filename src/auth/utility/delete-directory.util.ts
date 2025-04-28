import * as fs from 'fs';

export const deleteTempDirectory = (path: string): void => {
  const tempDirectoryPath = path;

  try {
    if (fs.existsSync(tempDirectoryPath)) {
      fs.rmSync(tempDirectoryPath, { recursive: true, force: true });
    } else {
      console.log(`Directory "temp" does not exist.`);
    }
  } catch (error) {
    console.error(`Failed to delete "temp" directory: ${error.message}`);
  }
};
