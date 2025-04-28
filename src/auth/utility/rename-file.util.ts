import * as fs from 'fs';

export const renameFile = (oldPath: string, newPath: string) => {
  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error(`Error renaming file: ${err.message}`);
      return;
    }
  });
};
