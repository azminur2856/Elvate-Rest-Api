import * as fs from 'fs';
import * as path from 'path';

export const clearDirectory = (
  directory: string,
  exceptfileName: string = '',
  startingWith: string = '',
): void => {
  // Delete old files starting with "exampleText-" except the new file
  const files = fs.readdirSync(directory);
  for (const file of files) {
    if (file.startsWith(startingWith) && file !== exceptfileName) {
      const filePath = path.join(directory, file);
      try {
        fs.unlinkSync(filePath); // Delete the file
      } catch (err) {
        console.error(`Failed to delete file: ${filePath}`, err);
      }
    }
  }
};
