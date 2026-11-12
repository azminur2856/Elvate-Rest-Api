/**
 * BE-28 one-time, idempotent migration: legacy PUBLIC profile pictures become
 * PRIVATE ImageKit files.
 *
 *   npm run migrate:avatars -- --dry-run            # list what would happen
 *   npm run migrate:avatars -- --yes                # private copies, keep old
 *   npm run migrate:avatars -- --yes --delete-old   # ... and delete the public files
 *
 * For every user with a legacy picture (profileImage set, profileImagePath
 * empty): ImageKit re-uploads the public file as a private one (it fetches the
 * URL itself) and the user row gets file id + path + a new avatarKey. Users
 * already migrated are skipped, so re-runs are safe. A missing source file
 * clears the picture (the user shows initials).
 *
 * The dev database is a copy of production but ImageKit is shared, so the old
 * public files are only deleted with --delete-old: use that on PRODUCTION only
 * (after the final merge, with the owner's OK); on dev it would delete files
 * production still shows.
 */
import '../set-timezone';
import 'dotenv/config';
import * as path from 'path';
import { DataSource, IsNull, Not } from 'typeorm';
import type { FileObject } from 'imagekit/dist/libs/interfaces';
import { Users } from '../users/entities/users.entity';
import { imagekit } from '../auth/utility/imagekit';
import { newAvatarKey } from '../common/media';
import { profileImageFolder } from '../users/users.service';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const deleteOld = args.has('--delete-old');

export const legacyPictureUrl = (u: Pick<Users, 'id' | 'profileImage'>) =>
  `${(process.env.IMAGEKIT_URL_ENDPOINT ?? '').replace(/\/+$/, '')}${profileImageFolder(u.id)}/${u.profileImage}`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  console.log(`Database: ${new URL(process.env.DATABASE_URL).host}`);
  if (!dryRun && !args.has('--yes')) {
    console.log(
      'Nothing changed. Use --dry-run to preview or --yes to migrate.',
    );
    return;
  }

  const ds = await new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [path.resolve(__dirname, '..') + '/**/*.entity{.ts,.js}'],
    synchronize: false,
  }).initialize();

  try {
    const users = ds.getRepository(Users);
    const todo = await users.find({
      select: ['id', 'email', 'profileImage'],
      where: {
        profileImage: Not('profile.png'),
        profileImagePath: IsNull(),
      },
    });
    const legacy = todo.filter((u) => !!u.profileImage);
    console.log(`${legacy.length} legacy public picture(s) to migrate.`);
    console.log(
      deleteOld
        ? 'Old public files WILL be deleted (--delete-old).'
        : 'Old public files are kept (add --delete-old on production).',
    );

    let moved = 0;
    let cleared = 0;
    for (const u of legacy) {
      const source = legacyPictureUrl(u);
      if (dryRun) {
        console.log(`  would migrate ${u.email}: ${u.profileImage}`);
        continue;
      }
      try {
        const upload = await imagekit.upload({
          file: source, // ImageKit fetches the public file itself
          fileName: u.profileImage,
          folder: profileImageFolder(u.id),
          useUniqueFileName: true,
          isPrivateFile: true,
        });
        await users.update(u.id, {
          profileImage: upload.name,
          profileImageFileId: upload.fileId,
          profileImagePath: upload.filePath,
          avatarKey: newAvatarKey(),
        });
        if (deleteOld) await deleteLegacyFile(u.id, u.profileImage);
        moved++;
        console.log(`  migrated ${u.email}`);
      } catch (err) {
        // the public source is gone: no picture rather than a broken one
        const message = (err as { message?: string }).message ?? String(err);
        if (/not found|404|could not fetch|fetch/i.test(message)) {
          await users.update(u.id, { profileImage: 'profile.png' });
          cleared++;
          console.log(`  ${u.email}: source missing, picture cleared`);
        } else {
          console.error(`  ${u.email}: FAILED (${message}); left as it was`);
        }
      }
    }
    if (!dryRun) {
      console.log(`Done: ${moved} migrated, ${cleared} cleared.`);
    }
  } finally {
    await ds.destroy();
  }
}

async function deleteLegacyFile(userId: string, name: string) {
  const files = await imagekit.listFiles({ path: profileImageFolder(userId) });
  const old = files.find(
    (f): f is FileObject =>
      f.type === 'file' && f.name === name && !f.isPrivateFile,
  );
  if (old) await imagekit.deleteFile(old.fileId);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
