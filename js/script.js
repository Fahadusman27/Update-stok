const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzccVJDYZrx0vbDLSJO_cl517jKYZ8NHPtwoU3MMG6w4dCPh0ECUDm-VE8VKAVETVNt/exec";

    // ── STATE ──────────────────────────────────────────────
    let stokData      = [];
    let pengajuanData = [];
    let currentTab    = 'stok';

    // ── DOM ────────────────────────────────────────────────
    const tableBody      = document.getElementById('tableBody');
    const filterDropdown = document.getElementById('filterDropdown');
    const searchKeyword  = document.getElementById('searchKeyword');
    const footerCount    = document.getElementById('footerCount');
    const refreshIcon    = document.getElementById('refreshIcon');
    const refreshText    = document.getElementById('refreshText');
    const statStokPcs    = document.getElementById('statStokPcs');
    const statStokTx     = document.getElementById('statStokTx');
    const statPengajuanCount = document.getElementById('statPengajuanCount');
    const statPengajuanTx    = document.getElementById('statPengajuanTx');
    const badgePengajuan     = document.getElementById('badgePengajuan');
    const th3 = document.getElementById('th3');
    const th5 = document.getElementById('th5');

    // ── INIT ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
      loadLocalCache();
      renderTable();
      updateMetrics();
      loadData();
    });

    // ── LOCAL CACHE ────────────────────────────────────────
    function loadLocalCache() {
      try {
        stokData = JSON.parse(localStorage.getItem('restok_history_icang') || '[]');

        // Flatten pengajuan from local sales storage
        const raw = JSON.parse(localStorage.getItem('pengajuan_history_sales') || '[]');
        if (Array.isArray(raw) && raw.length > 0) {
          const flat = [];
          raw.forEach(rec => {
            if (!rec) return;
            // New format: rec.items = array of product name strings
            if (Array.isArray(rec.items)) {
              if (typeof rec.items[0] === 'string') {
                // Simple format: items = ['Selena', 'Indigo', ...]
                rec.items.forEach(prodName => {
                  flat.push({
                    tanggal:    rec.tanggal || '-',
                    namaSales:  rec.namaSales || '-',
                    namaProduk: prodName,
                    catatan:    rec.catatan || '',
                  });
                });
              } else {
                // Legacy format: items = [{ namaProduk, sisaStok }]
                rec.items.forEach(it => {
                  flat.push({
                    tanggal:    rec.tanggal || '-',
                    namaSales:  rec.namaSales || '-',
                    namaProduk: it.namaProduk || '-',
                    catatan:    rec.catatan || '',
                  });
                });
              }
            }
          });
          pengajuanData = flat;
        }
      } catch(e) {
        stokData = []; pengajuanData = [];
      }
    }

    // ── LOAD FROM SERVER ───────────────────────────────────
    async function loadData(isManual = false) {
      if (isManual) {
        refreshIcon.classList.add('spinning');
        refreshText.textContent = 'Memuat...';
      }
      try {
        const res    = await fetch(`${SCRIPT_URL}?action=getDashboard`);
        const result = await res.json();

        if (result.status === 'success' && result.data) {
          if (Array.isArray(result.data.icang)) {
            stokData = result.data.icang;
            localStorage.setItem('restok_history_icang', JSON.stringify(stokData));
          }
          if (Array.isArray(result.data.pengajuan)) {
            pengajuanData = result.data.pengajuan;
          }
        } else {
          await fetchFallback('Icang');
          await fetchFallback('Pengajuan');
        }
      } catch(e) {
        console.warn('Live data gagal dimuat, pakai cache:', e);
      } finally {
        renderTable();
        updateMetrics();
        if (isManual) {
          refreshIcon.classList.remove('spinning');
          refreshText.textContent = 'Segarkan';
        }
      }
    }

    async function fetchFallback(penanda) {
      try {
        const res    = await fetch(`${SCRIPT_URL}?action=getHistory&penanda=${penanda}`);
        const result = await res.json();
        if (result.status === 'success' && Array.isArray(result.data)) {
          if (penanda.toLowerCase() === 'icang') {
            stokData = result.data;
            localStorage.setItem('restok_history_icang', JSON.stringify(stokData));
          } else {
            pengajuanData = result.data;
          }
        }
      } catch(e) {}
    }

    // ── SWITCH TAB ─────────────────────────────────────────
    function switchTab(tab) {
      currentTab = tab;

      // Tab button styling
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById(`tab-${tab}`);
      if (btn) btn.classList.add('active');

      // Metric card active ring
      document.getElementById('metricStok').classList.toggle('active-stok', tab === 'stok');
      document.getElementById('metricPengajuan').classList.toggle('active-pengajuan', tab === 'pengajuan');

      // Column header labels
      if (tab === 'stok') {
        th3.textContent = 'Lokasi Gudang';
        th5.textContent = 'Jumlah Restok';
      } else {
        th3.textContent = 'Sales Pemohon';
        th5.textContent = 'Catatan';
      }

      // Reset filter
      filterDropdown.value = '';
      updateFilterOptions();
      renderTable();
    }

    // ── FILTER OPTIONS ─────────────────────────────────────
    function updateFilterOptions() {
      const cur = filterDropdown.value;
      filterDropdown.innerHTML = '';

      if (currentTab === 'stok') {
        const locs = [...new Set(stokData.map(s => {
          let loc = s.lokasi || s.namaSales || '';
          if (loc.toLowerCase().startsWith('gudang (')) loc = loc.slice(8, -1).trim();
          else if (loc.toLowerCase().startsWith('gudang')) loc = loc.slice(6).trim();
          return loc;
        }).filter(Boolean))].sort();

        addOption('', 'Semua Lokasi');
        locs.forEach(l => addOption(l, `Lokasi: ${l}`, l === cur));
      } else {
        const names = [...new Set(pengajuanData.map(p => (p.namaSales || '').trim()).filter(Boolean))].sort();
        addOption('', 'Semua Sales');
        names.forEach(n => addOption(n, `Sales: ${n}`, n === cur));
      }
    }

    function addOption(value, text, selected = false) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      if (selected) opt.selected = true;
      filterDropdown.appendChild(opt);
    }

    // ── METRICS ────────────────────────────────────────────
    function updateMetrics() {
      const stokQty = stokData.reduce((a, c) => a + (Number(c.jumlahProduk) || 0), 0);
      statStokPcs.textContent = `${stokQty.toLocaleString('id-ID')} pcs`;
      statStokTx.textContent  = `${stokData.length} pencatatan`;

      const pSales = [...new Set(pengajuanData.map(p => p.namaSales).filter(Boolean))];
      statPengajuanCount.textContent = `${pengajuanData.length} barang`;
      statPengajuanTx.textContent    = pSales.length > 0 ? `${pSales.length} sales mengajukan` : 'Belum ada pengajuan';

      if (pengajuanData.length > 0) {
        badgePengajuan.textContent = pengajuanData.length;
        badgePengajuan.style.display = 'inline-flex';
      } else {
        badgePengajuan.style.display = 'none';
      }

      updateFilterOptions();
    }

    // ── RENDER TABLE ───────────────────────────────────────
    function renderTable() {
      const kw     = (searchKeyword.value || '').toLowerCase().trim();
      const filter = (filterDropdown.value || '').toLowerCase().trim();

      let rows = [];

      if (currentTab === 'stok') {
        stokData.forEach(item => {
          let loc = item.lokasi || item.namaSales || 'Gudang';
          if (loc.toLowerCase().startsWith('gudang (')) loc = loc.slice(8, -1).trim();
          else if (loc.toLowerCase().startsWith('gudang')) loc = loc.slice(6).trim();
          rows.push({ ...item, _loc: loc, _tipe: 'stok' });
        });

        if (filter) rows = rows.filter(r => r._loc.toLowerCase().includes(filter));
      } else {
        pengajuanData.forEach(item => {
          rows.push({ ...item, _tipe: 'pengajuan' });
        });
        if (filter) rows = rows.filter(r => (r.namaSales || '').toLowerCase().includes(filter));
      }

      if (kw) {
        rows = rows.filter(r =>
          (r.namaProduk || '').toLowerCase().includes(kw) ||
          (r.tanggal    || '').toLowerCase().includes(kw) ||
          (r.namaSales  || r._loc || '').toLowerCase().includes(kw) ||
          (r.catatan    || '').toLowerCase().includes(kw)
        );
      }

      footerCount.textContent = `Menampilkan ${rows.length} data (${currentTab === 'stok' ? 'Stok Gudang' : 'Pengajuan Sales'})`;

      if (rows.length === 0) {
        tableBody.innerHTML = `<tr class="empty-row"><td colspan="6">
          <svg style="width:32px;height:32px;margin:0 auto 8px;color:var(--slate-300)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <div style="font-weight:700;color:var(--slate-600)">Tidak ada data ditemukan</div>
          <div style="font-size:11px;margin-top:4px">Coba ubah kata kunci pencarian atau filter</div>
        </td></tr>`;
        return;
      }

      tableBody.innerHTML = rows.map((row, idx) => {
        if (row._tipe === 'stok') {
          return `
            <tr>
              <td class="center mono">${idx + 1}</td>
              <td class="mono">${esc(row.tanggal || '-')}</td>
              <td>
                <span class="name-pill green">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  ${esc(row._loc || 'Gudang')}
                </span>
              </td>
              <td style="font-weight:700;color:var(--slate-900)">${esc(row.namaProduk || '-')}</td>
              <td class="right">
                <span class="qty-pill green">${Number(row.jumlahProduk || 0).toLocaleString('id-ID')} pcs</span>
              </td>
              <td class="center">
                <span class="status-pill done">✓ Tercatat</span>
              </td>
            </tr>`;
        } else {
          // Pengajuan row
          return `
            <tr>
              <td class="center mono">${idx + 1}</td>
              <td class="mono">${esc(row.tanggal || '-')}</td>
              <td>
                <span class="name-pill indigo">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  ${esc(row.namaSales || '-')}
                </span>
              </td>
              <td style="font-weight:700;color:var(--slate-900)">${esc(row.namaProduk || '-')}</td>
              <td>
                ${row.catatan
                  ? `<span style="font-size:11px;color:var(--slate-500);font-style:italic">"${esc(row.catatan)}"</span>`
                  : `<span style="color:var(--slate-300);font-size:11px">—</span>`}
              </td>
              <td class="center">
                <span class="chip indigo">Diajukan</span>
              </td>
            </tr>`;
        }
      }).join('');
    }

    function esc(s) {
      return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
    }
