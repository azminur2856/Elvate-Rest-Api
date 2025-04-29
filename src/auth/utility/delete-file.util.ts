import * as fs from 'fs';
export const deleteFile = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting file: ${filePath}`, err);
      }
    });
  } else {
    console.log(`File not found: ${filePath}`);
  }
};
