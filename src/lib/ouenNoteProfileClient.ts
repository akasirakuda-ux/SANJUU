import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  OUEN_NOTE_FIELD_LIMITS,
  OUEN_NOTE_PROFILE_COLLECTION,
  OUEN_NOTE_PROFILE_FIELD_LIMITS,
} from './ouenNoteConfig';
import { formatConsultantProfileFromParts } from './ouenNoteTopicFormat';

export type OuenNoteParticipantProfile = {
  ageText: string;
  genderText: string;
  occupationText: string;
  updatedAtMs?: number;
};

export const emptyOuenNoteParticipantProfile = (): OuenNoteParticipantProfile => ({
  ageText: '',
  genderText: '',
  occupationText: '',
});

export function clipOuenNoteParticipantProfile(
  profile: OuenNoteParticipantProfile,
): OuenNoteParticipantProfile {
  return {
    ageText: profile.ageText.slice(0, OUEN_NOTE_PROFILE_FIELD_LIMITS.ageText),
    genderText: profile.genderText.slice(0, OUEN_NOTE_PROFILE_FIELD_LIMITS.genderText),
    occupationText: profile.occupationText.slice(0, OUEN_NOTE_PROFILE_FIELD_LIMITS.occupationText),
  };
}

export async function fetchOuenNoteParticipantProfile(
  uid: string,
): Promise<OuenNoteParticipantProfile | null> {
  const id = uid.trim();
  if (!id) return null;
  const snap = await getDoc(doc(db, OUEN_NOTE_PROFILE_COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return clipOuenNoteParticipantProfile({
    ageText: typeof data.ageText === 'string' ? data.ageText : '',
    genderText: typeof data.genderText === 'string' ? data.genderText : '',
    occupationText: typeof data.occupationText === 'string' ? data.occupationText : '',
    updatedAtMs: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : undefined,
  });
}

export async function saveOuenNoteParticipantProfile(
  uid: string,
  profile: OuenNoteParticipantProfile,
): Promise<void> {
  const id = uid.trim();
  if (!id) throw new Error('ログインが必要です');
  const clipped = clipOuenNoteParticipantProfile(profile);
  const now = Date.now();
  await setDoc(
    doc(db, OUEN_NOTE_PROFILE_COLLECTION, id),
    {
      ageText: clipped.ageText.trim(),
      genderText: clipped.genderText.trim(),
      occupationText: clipped.occupationText.trim(),
      updatedAtMs: now,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function consultantProfileFromParticipantProfile(
  profile: OuenNoteParticipantProfile,
): string {
  return formatConsultantProfileFromParts(profile).slice(0, OUEN_NOTE_FIELD_LIMITS.consultantProfile);
}

export function ouenNoteProfileSaveErrorMessage(e: unknown): string {
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
  if (code === 'permission-denied') {
    return 'プロフィールを保存できません。ログインし直してからお試しください';
  }
  return 'プロフィールを保存できませんでした';
}
