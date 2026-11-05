'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { IMPORT_FIELDS, formatDate, type ColumnMapping, type ImportField } from '@bvac/core';
import { formats, importRegistrations, parseCsvRecords, suggestMapping, type CsvRecords } from '@bvac/se-bridge';
import { downloadText } from '@/lib/download';
import { newArrivalsCsv } from '@/lib/import-sample';
import { useSeason } from '@/lib/season-store';
import { AdminHeader } from './AdminNav';

const SAMPLE_NAME = 'sportsengine-new-registrations-sample.csv';

/** Upload a SportsEngine Saved Report, check the column mapping, review the report, add to the season. */
export function ImportPage() {
  const { data, index, applyImported } = useSeason();
  const [file, setFile] = useState<{ name: string; records: CsvRecords } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null);

  const load = (name: string, text: string) => {
    try {
      const records = parseCsvRecords(text);
      if (records.headers.length === 0 || records.rows.length === 0) throw new Error('No rows found. Is this a CSV export with a header row?');
      setFile({ name, records });
      setMapping(suggestMapping(records.headers));
      setError(null);
      setDone(null);
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  const result = useMemo(() => {
    if (!file) return null;
    return importRegistrations(file.records.rows, mapping, data, { lineNumbers: file.records.lineNumbers, source: 'sportsengine-csv' });
  }, [file, mapping, data]);

  const created = result ? result.upserts.registrations.filter((r) => !index.registration.has(r.id)) : [];
  const mappedCount = IMPORT_FIELDS.filter((f) => mapping[f]).length;

  return (
    <div className="adm-stack">
      <AdminHeader title="Import from SportsEngine" />
      <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
        Export the soccer registration Saved Report from SportsEngine as CSV and drop it here. Re-importing the same file is safe: rows
        already imported are matched by SportsEngine registration ID, then by player name and birthdate, and are never duplicated.
      </p>

      <section className="card adm-stack" aria-labelledby="imp-file">
        <h2 id="imp-file" style={{ margin: 0, fontSize: 18 }}>
          1. Choose a file
        </h2>
        <div className="adm-row">
          <label className="button small secondary" style={{ cursor: 'pointer' }}>
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="adm-sr"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) load(f.name, await f.text());
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" className="button small" onClick={() => load(SAMPLE_NAME, newArrivalsCsv(data))}>
            Use the sample file
          </button>
          <button type="button" className="adm-btn" onClick={() => downloadText(SAMPLE_NAME, newArrivalsCsv(data))}>
            Download the sample
          </button>
        </div>
        <p className="muted adm-small" style={{ margin: 0 }}>
          The sample is a made-up SportsEngine export with 8 families who registered after the demo season, written the way parents type
          (nicknames, initials), plus two answers the importer can&apos;t read so the report has something to show.
        </p>
        {error && (
          <p role="alert" className="badge critical">
            {error}
          </p>
        )}
        {file && (
          <p className="adm-small" style={{ margin: 0 }}>
            <b>{file.name}</b> · {file.records.rows.length} rows · {file.records.headers.length} columns
          </p>
        )}
      </section>

      {file && result && (
        <>
          <section className="card adm-stack" aria-labelledby="imp-map">
            <h2 id="imp-map" style={{ margin: 0, fontSize: 18 }}>
              2. Check the columns
            </h2>
            <p className="muted adm-small" style={{ margin: 0 }}>
              {mappedCount} of {IMPORT_FIELDS.length} fields matched to a column automatically. Change any that look wrong; the report below
              updates as you go.
            </p>
            <details>
              <summary className="adm-small">Show the column mapping</summary>
              <div className="table-wrap" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Team Builder field</th>
                      <th scope="col">Column in your file</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IMPORT_FIELDS.map((f) => (
                      <tr key={f}>
                        <td>
                          <label htmlFor={`map-${f}`}>{fieldLabel(f)}</label>
                        </td>
                        <td>
                          <select
                            id={`map-${f}`}
                            value={mapping[f] ?? ''}
                            onChange={(e) => {
                              const next = { ...mapping };
                              if (e.target.value) next[f] = e.target.value;
                              else delete next[f];
                              setMapping(next);
                            }}
                          >
                            <option value="">Not in this file</option>
                            {file.records.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="card adm-stack" aria-labelledby="imp-report">
            <h2 id="imp-report" style={{ margin: 0, fontSize: 18 }}>
              3. Review the import
            </h2>
            <div className="adm-chips">
              <span className="badge good">{result.created} new</span>
              <span className="badge">{result.updated} updated</span>
              <span className="badge">{result.unchanged} unchanged</span>
              {result.skipped > 0 && <span className="badge critical">{result.skipped} skipped</span>}
              <span className={`badge ${result.issues.length ? 'warning' : 'good'}`}>
                {result.issues.length} issue{result.issues.length === 1 ? '' : 's'}
              </span>
            </div>
            {result.issues.length > 0 && (
              <ul className="adm-small" style={{ margin: 0, paddingLeft: 18 }}>
                {result.issues.map((f, i) => (
                  <li key={i}>
                    <span className={`badge ${f.severity}`}>{f.severity}</span> {f.message}
                  </li>
                ))}
              </ul>
            )}
            {created.length > 0 && (
              <div className="table-wrap" tabIndex={0}>
                <table>
                  <caption className="adm-small muted" style={{ textAlign: 'left' }}>
                    New registrations
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Player</th>
                      <th scope="col">Division</th>
                      <th scope="col">Registered</th>
                      <th scope="col">Team choices</th>
                      <th scope="col">Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {created.map((r) => {
                      const p = result.upserts.players.find((x) => x.id === r.playerId);
                      const teamLabel = (id: string) => data.teams.find((t) => t.id === id)?.label ?? '?';
                      return (
                        <tr key={r.id}>
                          <td>{p ? `${p.firstName} ${p.lastName}` : r.playerId}</td>
                          <td>{index.division.get(r.divisionId)?.name}</td>
                          <td>
                            {formatDate(r.submittedAt.slice(0, 10))} <span className="muted">({r.window})</span>
                          </td>
                          <td>{r.choices.length ? r.choices.map((c) => teamLabel(c.teamId)).join(', ') : <span className="muted">none</span>}</td>
                          <td className="adm-small">
                            {r.requests.length
                              ? r.requests.map((q) => `${q.targetName} (${q.matchStatus})`).join('; ')
                              : <span className="muted">none</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="adm-row">
              <button
                type="button"
                className="button"
                disabled={result.created + result.updated === 0}
                onClick={() => {
                  applyImported(result.upserts);
                  setDone({ created: result.created, updated: result.updated });
                }}
              >
                {result.created + result.updated === 0 ? 'Nothing new to add' : `Add ${result.created} new and ${result.updated} updated to the season`}
              </button>
              {done && (
                <span role="status" className="adm-small">
                  Added. {done.created} new registration{done.created === 1 ? '' : 's'} are now on the <Link href="/admin/">dashboard</Link> and
                  team boards, placed by the engine.
                </span>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** "Parent/Guardian Email" style labels from the bridge's report headers. */
function fieldLabel(f: ImportField): string {
  return (formats.REPORT_HEADERS[f] ?? f).replace(formats.SCHOOL_YEAR_TOKEN ?? '', '2026-27');
}
