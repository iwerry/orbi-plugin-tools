/*
 * ORBI BeatMarker — marcadores no ritmo da música (Premiere + After Effects).
 */
(function () {
  'use strict';
  var ui = ORBI.ui, $ = ui.$, host = ORBI.host;
  var TAG = 'orbi:beat';
  var offset = ui.bindSlider('offset', function (v) { return (v > 0 ? '+' : '') + v + ' ms'; });
  var bpm = ui.bindSlider('bpm', function (v) { return v ? String(v) : 'auto'; });

  function mark() {
    var every = +$('#every').value;
    return host.call('beatmarker.getSource', {}).then(function (src) {
      var p = { every: Math.min(every, 4) === 4 ? 1 : every, bpm: bpm() || null };
      var args = ['beats', src.path, '--start', String(src.inPoint), '--end', String(src.outPoint), '--params', JSON.stringify(p)];
      return ORBI.engine.run(args).then(function (r) {
        var off = offset() / 1000;
        var srcTimes = every >= 4 ? r.downbeats.filter(function (t, i) { return i % (every / 4) === 0; }) : r.marked;
        var times = srcTimes.map(function (t) { return src.start + (t - src.inPoint) / src.speed + off; })
          .filter(function (t) { return t >= src.start - 1e-3; });
        $('#sBpm').textContent = r.bpm.toFixed(1);
        $('#sBeats').textContent = r.beats.length;
        return host.call('beatmarker.addMarkers', { times: times, tag: TAG, bpm: r.bpm, target: $('#target').value, layer: src.layer })
          .then(function (h) {
            $('#sMarks').textContent = h.count;
            return h.count + ' marcador(es) criados · ' + r.bpm.toFixed(1) + ' BPM.';
          });
      });
    });
  }

  ui.boot(function () {
    document.body.classList.add(host.isPremiere ? 'is-ppro' : 'is-ae');
    $('#btnMark').addEventListener('click', function () { ui.task('Detectando beats…', mark); });
    $('#btnClear').addEventListener('click', function () {
      ui.task('Limpando…', function () {
        return host.call('beatmarker.clearMarkers', { tag: TAG }).then(function (h) { return h.count + ' marcador(es) removidos.'; });
      });
    });
  });
})();
