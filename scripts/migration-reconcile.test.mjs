import {it,expect} from 'vitest';
import {compareCopies,parseCopy} from './migration-reconcile.mjs';
const copy=(rows,table='public.jobs',columns='id, name')=>`COPY ${table} (${columns}) FROM stdin;\n${rows.join('\n')}\n\\.\n`;
it('ignores row order but preserves duplicates',()=>{
 expect(compareCopies(copy(['1\ta','2\tb']),copy(['2\tb','1\ta'])).passed).toBe(true);
 expect(compareCopies(copy(['1\ta','1\ta']),copy(['1\ta','2\tb'])).passed).toBe(false);
});
it('detects changed password hashes without returning their values',()=>{
 const r=compareCopies(copy(['1\told-hash'],'auth.users'),copy(['1\tnew-hash'],'auth.users'));
 expect(r.passed).toBe(false);expect(JSON.stringify(r)).not.toContain('hash');
});
it('detects missing/extra tables, rows and column changes',()=>{
 expect(compareCopies(copy(['1']),copy(['1'],'public.other')).passed).toBe(false);
 expect(compareCopies(copy(['1']),copy(['1','2'])).passed).toBe(false);
 expect(compareCopies(copy(['1']),copy(['1'],'public.jobs','name, id')).passed).toBe(false);
});
it('rejects truncation and duplicate COPY sections',()=>{
 expect(()=>parseCopy('COPY auth.users (id) FROM stdin;\n1')).toThrow();
 expect(()=>parseCopy(copy(['1'])+copy(['2']))).toThrow();
});
