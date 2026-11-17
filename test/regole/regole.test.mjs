// Test delle regole Firestore sull'emulatore: npm run test:regole (serve Java).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, arrayUnion, arrayRemove, deleteField, Timestamp, writeBatch } from 'firebase/firestore';

let env;
const db = (uid, email) => env.authenticatedContext(uid, { email: email || `${uid}@x.it` }).firestore();
const ospite = () => env.unauthenticatedContext().firestore();
const fra = giorni => Timestamp.fromMillis(Date.now() + giorni * 864e5);

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'rigordati-prova', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const f = c.firestore();
    await setDoc(doc(f, 'famiglie/F'), { nome: 'Casa', membri: ['anna', 'bruno'], nomi: { anna: 'Anna', bruno: 'Bruno' } });
    await setDoc(doc(f, 'famiglie/F/voci/V'), { famiglia: 'F', tipo: 'todo', testo: 'pane', autoreUid: 'anna' });
    await setDoc(doc(f, 'inviti/BUONO234'), { famiglia: 'F', da: 'anna', scade: fra(7) });
    await setDoc(doc(f, 'inviti/VECCHIO2'), { famiglia: 'F', da: 'anna', scade: fra(-1) });
    await setDoc(doc(f, 'famiglie/G'), { nome: 'Altri', membri: ['zeta'], nomi: { zeta: 'Zeta' } });
    await setDoc(doc(f, 'inviti/ALTRAFAM'), { famiglia: 'G', da: 'zeta', scade: fra(7) });
    await setDoc(doc(f, 'voci/legacy'), { tipo: 'todo', testo: 'vecchia' });
  });
});

const voce = (extra = {}) => ({ famiglia: 'F', tipo: 'impegno', testo: 'dentista', autoreUid: 'anna', ...extra });

test('i membri leggono e scrivono le voci, gli estranei no', async () => {
  await assertSucceeds(getDocs(collection(db('bruno'), 'famiglie/F/voci')));
  await assertSucceeds(setDoc(doc(db('anna'), 'famiglie/F/voci/N'), voce()));
  await assertSucceeds(updateDoc(doc(db('bruno'), 'famiglie/F/voci/V'), { fatto: true }));
  await assertFails(getDocs(collection(db('zeta'), 'famiglie/F/voci')));
  await assertFails(getDoc(doc(db('zeta'), 'famiglie/F/voci/V')));
  await assertFails(setDoc(doc(db('zeta'), 'famiglie/F/voci/N'), voce({ autoreUid: 'zeta' })));
  await assertFails(getDoc(doc(ospite(), 'famiglie/F/voci/V')));
});

test('le voci devono essere valide e firmate da chi scrive', async () => {
  await assertFails(setDoc(doc(db('anna'), 'famiglie/F/voci/N'), voce({ autoreUid: 'bruno' })));
  await assertFails(setDoc(doc(db('anna'), 'famiglie/F/voci/N'), voce({ famiglia: 'G' })));
  await assertFails(setDoc(doc(db('anna'), 'famiglie/F/voci/N'), voce({ tipo: 'boh' })));
  await assertFails(setDoc(doc(db('anna'), 'famiglie/F/voci/N'), voce({ testo: 'x'.repeat(501) })));
  await assertSucceeds(setDoc(doc(db('anna'), 'famiglie/F/voci/M'), voce({ autoreUid: '', migrata: true })));
});

test('famiglia: la vede solo chi ne fa parte; crearla solo per sé', async () => {
  await assertSucceeds(getDoc(doc(db('anna'), 'famiglie/F')));
  await assertFails(getDoc(doc(db('zeta'), 'famiglie/F')));
  await assertSucceeds(setDoc(doc(db('carla'), 'famiglie/N'), { nome: 'Nuova', membri: ['carla'], nomi: { carla: 'Carla' } }));
  await assertFails(setDoc(doc(db('carla'), 'famiglie/M'), { nome: 'Furba', membri: ['carla', 'anna'] }));
});

test('entrare: solo con un invito valido di quella famiglia, aggiungendo solo sé stessi', async () => {
  const entra = (uid, codice, fid = 'F', extra = {}) => updateDoc(doc(db(uid), `famiglie/${fid}`), { membri: arrayUnion(uid), [`nomi.${uid}`]: uid, invito: codice, ...extra });
  await assertFails(entra('carla', 'NONESIST'));
  await assertFails(entra('carla', 'VECCHIO2'));
  await assertFails(entra('carla', 'ALTRAFAM'));
  await assertFails(entra('carla', 'BUONO234', 'F', { nome: 'Rubata' }));
  await assertFails(updateDoc(doc(db('carla'), 'famiglie/F'), { membri: arrayUnion('carla', 'dario'), invito: 'BUONO234' }));
  await assertSucceeds(entra('carla', 'BUONO234'));
  await assertSucceeds(getDocs(collection(db('carla'), 'famiglie/F/voci')));
});

test('uscire: solo sé stessi, senza toccare gli altri', async () => {
  await assertFails(updateDoc(doc(db('anna'), 'famiglie/F'), { membri: arrayRemove('bruno') }));
  await assertSucceeds(updateDoc(doc(db('anna'), 'famiglie/F'), { membri: arrayRemove('anna'), 'nomi.anna': deleteField() }));
  await assertFails(getDocs(collection(db('anna'), 'famiglie/F/voci')));
});

test('membri: rinominano la famiglia ma non cambiano i membri', async () => {
  await assertSucceeds(updateDoc(doc(db('bruno'), 'famiglie/F'), { nome: 'Casa Rossi', 'nomi.bruno': 'Bru' }));
  await assertFails(updateDoc(doc(db('zeta'), 'famiglie/F'), { nome: 'Mia' }));
});

test('inviti: si leggono conoscendo il codice, non si elencano; li crea solo un membro', async () => {
  await assertSucceeds(getDoc(doc(db('carla'), 'inviti/BUONO234')));
  await assertFails(getDocs(collection(db('carla'), 'inviti')));
  await assertSucceeds(setDoc(doc(db('anna'), 'inviti/NUOVO234'), { famiglia: 'F', da: 'anna', scade: fra(7) }));
  await assertFails(setDoc(doc(db('zeta'), 'inviti/NUOVO567'), { famiglia: 'F', da: 'zeta', scade: fra(7) }));
  await assertFails(setDoc(doc(db('anna'), 'inviti/NUOVO890'), { famiglia: 'F', da: 'bruno', scade: fra(7) }));
});

test('profili e dispositivi: ognuno solo i propri', async () => {
  await assertSucceeds(setDoc(doc(db('anna'), 'utenti/anna'), { famiglie: ['F'] }));
  await assertFails(setDoc(doc(db('anna'), 'utenti/bruno'), { famiglie: ['F'] }));
  await assertFails(getDoc(doc(db('bruno'), 'utenti/anna')));
  await assertSucceeds(setDoc(doc(db('anna'), 'dispositivi/tok'), { token: 'tok', uid: 'anna', famiglie: ['F'] }));
  await assertFails(setDoc(doc(db('anna'), 'dispositivi/tok2'), { token: 'tok2', uid: 'bruno' }));
  await assertFails(getDocs(collection(db('anna'), 'dispositivi')));
  await assertFails(deleteDoc(doc(db('bruno'), 'dispositivi/tok')));
});

test('vecchio frigo: solo le email elencate', async () => {
  await assertFails(getDocs(collection(db('zeta', 'zeta@x.it'), 'voci')));
  await assertSucceeds(getDocs(collection(db('anna', 'EMAIL_1'), 'voci')));
});

test('migrazione a lotti: 15 voci in un colpo passano le regole', async () => {
  const anna = db('anna'), b = writeBatch(anna);
  for (let i = 0; i < 15; i++) b.set(doc(anna, `famiglie/F/voci/m${i}`), voce({ autoreUid: '', migrata: true }));
  await assertSucceeds(b.commit());
});
