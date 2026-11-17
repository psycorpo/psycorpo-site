/* Tests offerts Psycorpo (page /tests/).
   Tout est calculé dans le navigateur : aucune réponse n'est envoyée ni enregistrée.
   window.QUIZZES = { id: config, ... } ; boutons [data-quiz="id"] ; ouverture directe avec /tests/#id */
(function () {
  var ALL = window.QUIZZES || {};
  var panel = document.getElementById('quiz-panel');
  var root = document.getElementById('quiz');
  var titleEl = document.getElementById('quiz-title');
  if (!panel || !root) return;

  var cfg, answers, step, steps, order, scale, PER_STEP, extra;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function scrollTop() { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  function open(id) {
    cfg = ALL[id];
    if (!cfg) return;
    answers = {}; step = 0;
    scale = cfg.scale || ['Pas du tout', 'Plutôt pas', 'Un peu', 'Plutôt oui', 'Tout à fait'];
    PER_STEP = cfg.perStep || 6;
    if (cfg.mode !== 'form') {
      steps = Math.ceil(cfg.items.length / PER_STEP) + (cfg.extra ? 1 : 0);
      extra = {};
      order = cfg.items.map(function (it, i) { return i; });
      var seed = 7;
      for (var i = order.length - 1; i > 0; i--) {   // mélange stable : les questions d'un même profil ne se suivent pas
        seed = (seed * 9301 + 49297) % 233280;
        var j = Math.floor(seed / 233280 * (i + 1));
        var t = order[i]; order[i] = order[j]; order[j] = t;
      }
    }
    titleEl.textContent = cfg.title;
    panel.hidden = false;
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    if (cfg.mode === 'form') renderForm(); else renderStep();
    scrollTop();
  }

  /* ---------- Tests en échelle (plusieurs étapes) ---------- */
  function renderStep() {
    root.innerHTML = '';
    var pct = Math.round(step / steps * 100);
    var head = el('div', 'q-progress', '<span>Étape ' + (step + 1) + ' sur ' + steps + '</span><div class="q-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>');
    root.appendChild(head);
    if (cfg.extra && step === steps - 1) return renderExtraStep();
    var form = el('form', 'q-form');
    var slice = order.slice(step * PER_STEP, (step + 1) * PER_STEP);
    slice.forEach(function (idx) { form.appendChild(scaleItem('q' + idx, cfg.items[idx].t, scale, function (v) { answers[idx] = v; }, answers[idx])); });
    var msg = el('p', 'q-msg'); msg.setAttribute('role', 'alert');
    var nav = el('div', 'q-nav');
    if (step > 0) {
      var back = el('button', 'btn btn-line', '← Retour'); back.type = 'button';
      back.addEventListener('click', function () { step--; renderStep(); scrollTop(); });
      nav.appendChild(back);
    }
    var next = el('button', 'btn btn-main', step === steps - 1 ? 'Voir mes résultats →' : 'Continuer →'); next.type = 'submit';
    nav.appendChild(next);
    form.appendChild(nav); form.appendChild(msg);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var missing = slice.filter(function (idx) { return !answers[idx]; });
      if (missing.length) {
        missing.forEach(function (idx) { form.querySelector('[name=q' + idx + ']').closest('fieldset').classList.add('q-missing'); });
        msg.textContent = 'Il reste ' + missing.length + (missing.length > 1 ? ' questions' : ' question') + ' sans réponse sur cette étape.';
        return;
      }
      if (step < steps - 1) { step++; renderStep(); } else { renderLikertResults(); }
      scrollTop();
    });
    root.appendChild(form);
  }

  /* Dernière étape facultative : questions à choix (unique ou multiple), analysées à part dans les résultats */
  function renderExtraStep() {
    var form = el('form', 'q-form');
    if (cfg.extraIntro) form.appendChild(el('p', 'q-lead', cfg.extraIntro));
    cfg.extra.forEach(function (q, qi) {
      var name = 'x' + qi;
      var fs = el('fieldset', 'q-item');
      fs.appendChild(el('legend', null, q.t + (q.type === 'multi' ? ' <span class="q-hint">(plusieurs réponses possibles)</span>' : '')));
      var list = el('div', 'q-options');
      q.options.forEach(function (o, oi) {
        var id = name + '_' + oi;
        var lb = el('label'); lb.setAttribute('for', id);
        var inp = document.createElement('input');
        inp.type = q.type === 'multi' ? 'checkbox' : 'radio'; inp.name = name; inp.id = id; inp.value = oi;
        if (extra[qi] && extra[qi].indexOf(oi) > -1) inp.checked = true;
        lb.appendChild(inp); lb.appendChild(el('span', null, o.t));
        list.appendChild(lb);
      });
      list.addEventListener('change', function () { fs.classList.remove('q-missing'); });
      fs.appendChild(list);
      form.appendChild(fs);
    });
    var msg = el('p', 'q-msg'); msg.setAttribute('role', 'alert');
    var nav = el('div', 'q-nav');
    var back = el('button', 'btn btn-line', '← Retour'); back.type = 'button';
    back.addEventListener('click', function () { save(); step--; renderStep(); scrollTop(); });
    var next = el('button', 'btn btn-main', 'Voir mes résultats →'); next.type = 'submit';
    nav.appendChild(back); nav.appendChild(next);
    form.appendChild(nav); form.appendChild(msg);
    function save() {
      cfg.extra.forEach(function (q, qi) {
        extra[qi] = [].map.call(form.querySelectorAll('[name=x' + qi + ']:checked'), function (b) { return Number(b.value); });
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      save();
      var missing = 0;
      cfg.extra.forEach(function (q, qi) { if (!extra[qi].length) { missing++; form.children[qi + (cfg.extraIntro ? 1 : 0)].classList.add('q-missing'); } });
      if (missing) { msg.textContent = 'Il reste ' + missing + (missing > 1 ? ' questions' : ' question') + ' sans réponse.'; return; }
      renderLikertResults();
      scrollTop();
    });
    root.appendChild(form);
  }

  function scaleItem(name, text, labels, onPick, current) {
    var fs = el('fieldset', 'q-item');
    fs.appendChild(el('legend', null, text));
    var row = el('div', 'q-scale');
    labels.forEach(function (lab, v) {
      var id = name + '_' + v;
      var lb = el('label'); lb.setAttribute('for', id);
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = name; inp.id = id; inp.value = v + 1;
      if (current === v + 1) inp.checked = true;
      inp.addEventListener('change', function () { onPick(v + 1); fs.classList.remove('q-missing'); });
      lb.appendChild(inp); lb.appendChild(el('span', null, lab));
      row.appendChild(lb);
    });
    fs.appendChild(row);
    return fs;
  }

  function renderLikertResults() {
    var totals = {}, counts = {};
    cfg.profiles.forEach(function (p) { totals[p.key] = 0; counts[p.key] = 0; });
    cfg.items.forEach(function (it, idx) { totals[it.k] += answers[idx]; counts[it.k] += 1; });
    var ranked = cfg.profiles.map(function (p) {
      var max = counts[p.key] * scale.length, min = counts[p.key];
      return { p: p, score: Math.round((totals[p.key] - min) / (max - min) * 100) };
    }).sort(function (a, b) { return b.score - a.score; });
    showResults(ranked, cfg.highlight || 1, 'Score de 0 à 100 pour chaque profil, calculé à partir de vos réponses.', '');
  }

  /* ---------- Test en formulaire (une seule page, questions variées) ---------- */
  function renderForm() {
    root.innerHTML = '';
    var form = el('form', 'q-form');
    cfg.questions.forEach(function (q, qi) {
      var name = 'f' + qi;
      var fs;
      if (q.type === 'scale') {
        fs = el('fieldset', 'q-item');
        fs.appendChild(el('legend', null, (qi + 1) + '. ' + q.t));
        (q.rows || [{ label: null }]).forEach(function (r, ri) {
          if (r.label) fs.appendChild(el('p', 'q-sub', r.label));
          var row = el('div', 'q-scale');
          q.labels.forEach(function (lab, v) {
            var id = name + '_' + ri + '_' + v;
            var lb = el('label'); lb.setAttribute('for', id);
            var inp = document.createElement('input');
            inp.type = 'radio'; inp.name = name + '_' + ri; inp.id = id; inp.value = v; inp.required = true;
            lb.appendChild(inp); lb.appendChild(el('span', null, lab));
            row.appendChild(lb);
          });
          fs.appendChild(row);
        });
      } else if (q.type === 'single' || q.type === 'multi') {
        fs = el('fieldset', 'q-item');
        fs.appendChild(el('legend', null, (qi + 1) + '. ' + q.t + (q.type === 'multi' ? ' <span class="q-hint">(plusieurs réponses possibles)</span>' : '')));
        var list = el('div', 'q-options');
        q.options.forEach(function (o, oi) {
          var id = name + '_' + oi;
          var lb = el('label'); lb.setAttribute('for', id);
          var inp = document.createElement('input');
          inp.type = q.type === 'single' ? 'radio' : 'checkbox'; inp.name = name; inp.id = id; inp.value = oi;
          if (q.type === 'single') inp.required = true;
          if (q.type === 'multi' && o.none) inp.dataset.none = '1';
          lb.appendChild(inp); lb.appendChild(el('span', null, o.t));
          list.appendChild(lb);
        });
        if (q.type === 'multi') list.addEventListener('change', function (e) {   // « Aucun » décoche le reste, et inversement
          var boxes = list.querySelectorAll('input');
          if (e.target.dataset.none && e.target.checked) boxes.forEach(function (b) { if (b !== e.target) b.checked = false; });
          else if (e.target.checked) boxes.forEach(function (b) { if (b.dataset.none) b.checked = false; });
        });
        fs.appendChild(list);
      } else {
        fs = el('div', 'q-item');
        var lab = el('label', 'q-open-label', (qi + 1) + '. ' + q.t + ' <span class="q-hint">(facultatif)</span>');
        lab.setAttribute('for', name);
        var ta = document.createElement('textarea'); ta.id = name; ta.name = name; ta.rows = 3; ta.maxLength = 400;
        ta.placeholder = q.placeholder || '';
        fs.appendChild(lab); fs.appendChild(ta);
      }
      form.appendChild(fs);
    });
    var msg = el('p', 'q-msg'); msg.setAttribute('role', 'alert');
    var nav = el('div', 'q-nav');
    var go = el('button', 'btn btn-main', 'Voir mes résultats →'); go.type = 'submit';
    nav.appendChild(go);
    form.appendChild(nav); form.appendChild(msg);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.querySelectorAll('.q-missing').forEach(function (n) { n.classList.remove('q-missing'); });
      var missing = 0;
      cfg.questions.forEach(function (q, qi) {
        var fs = form.children[qi];
        if (q.type === 'scale') {
          (q.rows || [{}]).forEach(function (r, ri) { if (!form.querySelector('[name=f' + qi + '_' + ri + ']:checked')) { missing++; fs.classList.add('q-missing'); } });
        } else if (q.type === 'single' || q.type === 'multi') {
          if (!form.querySelector('[name=f' + qi + ']:checked')) { missing++; fs.classList.add('q-missing'); }
        }
      });
      if (missing) { msg.textContent = 'Il reste ' + missing + (missing > 1 ? ' réponses' : ' réponse') + ' à donner (les questions encadrées).'; var first = form.querySelector('.q-missing'); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      // Calcul : chaque réponse ajoute des points de vigilance à un ou plusieurs axes
      var pts = {}, max = {};
      cfg.profiles.forEach(function (p) { pts[p.key] = 0; max[p.key] = 0; });
      var openText = '';
      cfg.questions.forEach(function (q, qi) {
        if (q.type === 'scale') {
          (q.rows || [{}]).forEach(function (r, ri) {
            var v = Number(form.querySelector('[name=f' + qi + '_' + ri + ']:checked').value);
            var w = r.points || q.points;
            var axis = r.k || q.k;
            pts[axis] += w[v]; max[axis] += Math.max.apply(null, w);
          });
        } else if (q.type === 'single') {
          var o = q.options[Number(form.querySelector('[name=f' + qi + ']:checked').value)];
          pts[q.k] += o.p; max[q.k] += Math.max.apply(null, q.options.map(function (x) { return x.p; }));
        } else if (q.type === 'multi') {
          var sum = 0;
          form.querySelectorAll('[name=f' + qi + ']:checked').forEach(function (b) { sum += q.options[Number(b.value)].p; });
          pts[q.k] += Math.min(sum, q.cap); max[q.k] += q.cap;
        } else {
          openText = (form.querySelector('[name=f' + qi + ']').value || '').trim();
        }
      });
      var ranked = cfg.profiles.map(function (p) { return { p: p, score: max[p.key] ? Math.round(pts[p.key] / max[p.key] * 100) : 0 }; })
        .sort(function (a, b) { return b.score - a.score; });
      showResults(ranked, cfg.highlight || 3, 'Niveau de vigilance de 0 à 100 pour chaque axe : plus la barre est longue, plus le sujet mérite votre attention.', openText);
      scrollTop();
    });
    root.appendChild(form);
  }

  /* ---------- Résultats communs ---------- */
  function showResults(ranked, show, scoreNote, openText) {
    root.innerHTML = '';
    var res = el('div', 'q-results');
    res.appendChild(el('p', 'eyebrow', 'Vos résultats'));
    res.appendChild(el('h2', null, cfg.resultTitle(ranked)));
    if (cfg.resultIntro) res.appendChild(el('p', 'q-lead', cfg.resultIntro(ranked)));
    var bars = el('div', 'q-bars');
    ranked.forEach(function (r, i) {
      bars.appendChild(el('div', 'q-row' + (i < show ? ' q-top' : ''), '<span class="q-name">' + r.p.name + '</span><span class="q-track"><i style="width:' + Math.max(r.score, 3) + '%"></i></span><span class="q-score">' + r.score + '</span>'));
    });
    res.appendChild(bars);
    res.appendChild(el('p', 'q-fine', scoreNote));
    if (openText) res.appendChild(el('p', 'q-note', '<strong>Votre priorité, dans vos mots :</strong> « ' + esc(openText) + ' »<br>Gardez-la en tête : c\'est un bon point de départ pour l\'échange.'));
    ranked.slice(0, show).forEach(function (r, i) {
      var card = el('article', 'q-card');
      card.appendChild(el('p', 'who', (show > 1 ? (i + 1) + ' · ' : '') + r.p.name));
      if (r.p.tagline) card.appendChild(el('p', 'q-tag', r.p.tagline));
      (r.p.blocks || []).forEach(function (b) { card.appendChild(el('h3', null, b[0])); card.appendChild(el('p', null, b[1])); });
      res.appendChild(card);
    });
    if (cfg.extra && cfg.extraResult && extra) {
      var ex = el('article', 'q-card q-extra');
      ex.innerHTML = cfg.extraResult(extra, cfg.extra, ranked);
      res.appendChild(ex);
    }
    var note = cfg.closeness ? cfg.closeness(ranked) : '';
    if (note) res.appendChild(el('p', 'q-note', note));
    var cta = el('div', 'q-cta');
    cta.innerHTML = '<h2>' + cfg.cta.title + '</h2><p>' + cfg.cta.text + '</p><a class="btn btn-main" href="' + cfg.cta.href + '">' + cfg.cta.button + '</a>' +
      (cfg.cta.more ? '<a class="q-more" href="' + cfg.cta.more[1] + '">' + cfg.cta.more[0] + '</a>' : '');
    res.appendChild(cta);
    res.appendChild(el('p', 'q-fine', cfg.disclaimer));
    var again = el('div', 'q-nav');
    var b1 = el('button', 'btn btn-line', 'Recommencer'); b1.type = 'button';
    b1.addEventListener('click', function () { open(location.hash.slice(1)); });
    var b2 = el('a', 'btn btn-line', 'Voir les autres questionnaires'); b2.href = '#choisir';
    again.appendChild(b1); again.appendChild(b2);
    res.appendChild(again);
    root.appendChild(res);
  }

  document.querySelectorAll('[data-quiz]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); open(b.getAttribute('data-quiz')); });
  });
  var close = document.getElementById('quiz-close');
  if (close) close.addEventListener('click', function () { panel.hidden = true; if (history.replaceState) history.replaceState(null, '', location.pathname); document.getElementById('choisir').scrollIntoView({ behavior: 'smooth' }); });
  if (location.hash && ALL[location.hash.slice(1)]) open(location.hash.slice(1));
  window.addEventListener('hashchange', function () { var id = location.hash.slice(1); if (ALL[id] && (!cfg || cfg !== ALL[id])) open(id); });
})();
