/* =========  UTILS  ========= */
const $ = q => document.querySelector(q);
const storage = {
    get(k, def = null){
        try{
            return JSON.parse(localStorage.getItem(k)) ?? def;
        }catch{
            return def;
        }
    },
    set(k, v){
        localStorage.setItem(k, JSON.stringify(v));
    }
};
const popup = (title, body) => {
    const div = document.createElement('div');
    div.className = 'popup-overlay';
    div.innerHTML = `<div class="popup">
        <h3>${title}</h3>
        <p>${body}</p>
        <button onclick="this.closest('.popup-overlay').remove()">OK</button>
    </div>`;
    document.body.appendChild(div);
};

/* =========  USER  ========= */
const User = {
    init(){
        const url = new URLSearchParams(location.search);
        const tgid = url.get('start') || url.get('userid') || 'demo_' + Math.random().toString(36).slice(2);
        this.id = tgid;
        this.ip = 'fake-ip'; // real IP needs server
        this.name = storage.get('name') || 'SAI Miner';
        this.avatar = storage.get('avatar') || 'https://i.pravatar.cc/150?u='+this.id;
        this.balance = storage.get('balance', 0);
        this.history = storage.get('history', []);
        this.tasks = storage.get('tasks', {
            join:{done:false},
            dailySign:{last:0},
            dailyBoost:{last:0,count:0},
            power:{last:0,count:0},
            extreme:{last:0,count:0}
        });
        this.mining = storage.get('mining', {running:false,start:0,acc:0});
        this.team = storage.get('team', {count:0,commission:0,valid:0});
        this.spins = storage.get('spins', 0);
        this.inviter = storage.get('inviter', null);
        // attribution
        if(url.get('start') && !this.inviter){
            this.inviter = url.get('start');
            storage.set('inviter', this.inviter);
            // notify inviter
            const inv = storage.get('user_'+this.inviter);
            if(inv){
                inv.team.valid += 1;
                inv.spins += 1;
                inv.balance += 100;
                inv.history.push({t:Date.now(),amt:100,src:'Valid invite'});
                storage.set('user_'+this.inviter, inv);
            }
        }
        storage.set('user_'+this.id, this.export());
    },
    export(){
        return {
            id:this.id,
            name:this.name,
            avatar:this.avatar,
            balance:this.balance,
            history:this.history,
            tasks:this.tasks,
            mining:this.mining,
            team:this.team,
            spins:this.spins,
            inviter:this.inviter
        };
    },
    save(){
        storage.set('user_'+this.id, this.export());
        storage.set('balance', this.balance);
        storage.set('history', this.history);
        storage.set('tasks', this.tasks);
        storage.set('mining', this.mining);
        storage.set('team', this.team);
        storage.set('spins', this.spins);
    },
    add(amt, src){
        this.balance += amt;
        this.history.push({t:Date.now(), amt, src});
        this.save();
        $('#main-balance').textContent = this.balance.toFixed(4);
    },
    deduct(amt, src){
        this.add(-amt, src);
    }
};
User.init();

/* =========  NAVIGATION  ========= */
const nav = {
    goto(page){
        document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
        $('#'+page).classList.add('active');
        document.querySelectorAll('.tab-bar button').forEach(b=>b.classList.remove('active'));
        $(`.tab-bar button[data-page="${page}"]`)?.classList.add('active');
        if(page==='leaderboard') this.loadLeaderboard();
        if(page==='history') this.loadHistory();
        if(page==='team') this.loadTeam();
    },
    loadLeaderboard(){
        const all = [];
        for(let i=0;i<localStorage.length;i++){
            const k = localStorage.key(i);
            if(k.startsWith('user_')){
                all.push(storage.get(k));
            }
        }
        all.sort((a,b)=>b.balance - a.balance);
        const podium = $('#podium');
        const list = $('#full-list');
        podium.innerHTML = '';
        list.innerHTML = '';
        [0,1,2].forEach(i=>{
            if(!all[i]) return;
            const div = document.createElement('div');
            div.className = 'podium-card ' + (i===0?'gold':i===1?'silver':'bronze');
            div.innerHTML = `<img src="${all[i].avatar}" width="50"><b>${all[i].name}</b><div>${all[i].balance.toFixed(4)} SAI</div>`;
            podium.appendChild(div);
        });
        all.slice(0,100).forEach((u,i)=>{
            const li = document.createElement('li');
            li.innerHTML = `<img src="${u.avatar}" width="30"> ${i+1}. ${u.name} – ${u.balance.toFixed(4)} SAI`;
            list.appendChild(li);
        });
    },
    loadHistory(){
        const box = $('#history-list');
        box.innerHTML = '';
        User.history.slice().reverse().forEach(h=>{
            const div = document.createElement('div');
            div.textContent = `${new Date(h.t).toLocaleString()}  ${h.amt>0?'+':''}${h.amt.toFixed(4)} SAI  (${h.src})`;
            box.appendChild(div);
        });
    },
    loadTeam(){
        $('#team-count').textContent = User.team.count;
        $('#team-commission').textContent = User.team.commission.toFixed(4);
        $('#valid-count').textContent = User.team.valid;
        $('#spin-chances').textContent = User.spins;
        $('#invite-link').value = `https://t.me/SAIMINE_BOT?start=${User.id}`;
        $('#qr').innerHTML = '';
        new QRCode($('#qr'), {text:`https://t.me/SAIMINE_BOT?start=${User.id}`, width:128, height:128});
    }
};

/* =========  MINING  ========= */
const Mining = {
    interval:null,
    init(){
        const m = User.mining;
        if(m.running){
            const elapsed = (Date.now() - m.start)/1000;
            if(elapsed > 7200){
                m.running = false; m.acc = 0;
            }else{
                this.startInterval();
            }
        }
        $('#start-mining').textContent = m.running ? 'Mining…' : 'Start Mining';
        $('#live-counter').textContent = m.acc.toFixed(4);
    },
    async start(){
        if(User.mining.running) return;
        // task gate
        const t = User.tasks;
        const today = new Date().toDateString();
        if(t.join.done === false || (new Date(t.dailySign.last)).toDateString() !== today){
            popup('Tasks missing', 'Complete all daily tasks to enable auto-mining.');
            return;
        }
        // ad
        await window.showGiga().catch(()=>{});
        User.mining.running = true;
        User.mining.start = Date.now();
        User.save();
        this.startInterval();
        $('#start-mining').textContent = 'Mining…';
    },
    startInterval(){
        this.interval = setInterval(()=>{
            const m = User.mining;
            const elapsed = (Date.now() - m.start)/1000;
            if(elapsed >= 7200){
                this.stop();
            }else{
                m.acc += 0.0056;
                $('#live-counter').textContent = m.acc.toFixed(4);
            }
        }, 1000);
    },
    stop(){
        clearInterval(this.interval);
        const earned = User.mining.acc;
        User.add(earned, 'Mining');
        popup('Mining complete', `You mined ${earned.toFixed(4)} SAI`);
        User.mining.running = false;
        User.mining.acc = 0;
        User.save();
        $('#start-mining').textContent = 'Start Mining';
    }
};

/* =========  TASKS  ========= */
const Tasks = {
    init(){
        const box = $('#task-list');
        box.innerHTML = '';
        const today = new Date().toDateString();
        const t = User.tasks;
        const items = [
            {id:'join', title:'Join SAI Community', desc:'Follow the official telegram channel', reward:50, once:true, done:t.join.done, action:()=>this.join()},
            {id:'dailySign', title:'Daily Sign in', desc:'Sign in every day', reward:10, cooldown:0, last:t.dailySign.last, action:()=>this.dailySign()},
            {id:'dailyBoost', title:'Daily Booster', desc:'Boost your machine energy', reward:10, max:4, cooldown:120, last:t.dailyBoost.last, count:t.dailyBoost.count, action:()=>this.dailyBoost()},
            {id:'power', title:'Power Supply', desc:'Attach power supply', reward:10, max:4, cooldown:120, last:t.power.last, count:t.power.count, action:()=>this.power()},
            {id:'extreme', title:'Extreme Booster', desc:'Run extreme mode', reward:10, max:4, cooldown:120, last:t.extreme.last, count:t.extreme.count, action:()=>this.extreme()}
        ];
        items.forEach(it=>{
            const div = document.createElement('div');
            div.className = 'task-item' + (it.done || (it.max && it.count>=it.max) ? ' completed':'');
            div.innerHTML = `
                <div class="task-top">
                    <div>
                        <b>${it.title}</b><br>
                        <small>${it.desc}</small>
                    </div>
                    <div class="reward">+${it.reward.toFixed(2)} SAI</div>
                </div>
                <button onclick="Tasks.items['${it.id}']()">${it.done?'Completed':it.max && it.count>=it.max?'Max reached':'Open Task'}</button>
            `;
            box.appendChild(div);
        });
        // tads TGB
        $('#tads-tgb').innerHTML = '<div id="tads-container-773"></div>';
        this.loadTadsTGB();
    },
    items:{
        async join(){
            if(User.tasks.join.done) return;
            window.open('https://t.me/SAIMINEOFFICIAL');
            await new Promise(r=>setTimeout(r,3000));
            User.tasks.join.done = true;
            User.add(50, 'Join Community');
            popup('Task complete', '+50.00 SAI');
            User.save();
            Tasks.init();
        },
        async dailySign(){
            const last = new Date(User.tasks.dailySign.last).toDateString();
            const today = new Date().toDateString();
            if(last === today) return popup('Already done', 'Come back tomorrow');
            await this.showAdradar();
            User.tasks.dailySign.last = Date.now();
            User.add(10, 'Daily Sign');
            User.save();
            Tasks.init();
        },
        async dailyBoost(){
            await this.cooldownAction('dailyBoost', 10, 4, 120, ()=>window.tads.init({widgetId:'774',type:'fullscreen',debug:false}).then(c=>c.showAd()));
        },
        async power(){
            await this.cooldownAction('power', 10, 4, 120, async()=>{ await window.initCdTma({id:'6090801'}).then(s=>s()); });
        },
        async extreme(){
            await this.cooldownAction('extreme', 10, 4, 120, ()=>{ p_adextra(()=>{},()=>{}); });
        },
        async cooldownAction(key, reward, max, cooldownSec, adFn){
            const t = User.tasks[key];
            const now = Date.now();
            if(t.count >= max) return popup('Max reached', 'Wait until reset');
            if(now - t.last < cooldownSec*1000) return popup('Cooldown', `Wait ${cooldownSec-Math.floor((now-t.last)/1000)} s`);
            await adFn();
            t.count += 1;
            t.last = now;
            User.add(reward, key);
            User.save();
            Tasks.init();
        },
        async showAdradar(){
            return new Promise(res=>{
                AdRadar.showAd({
                    adUnitId:'68c85947cf96474af2aa0701',
                    onReward:res
                });
            });
        },
        loadTadsTGB(){
            window.tads.init({
                widgetId:'773',
                type:'static',
                debug:false,
                onClickReward:(id)=>{
                    if(storage.get('tgb_click_'+new Date().toDateString())) return;
                    storage.set('tgb_click_'+new Date().toDateString(), true);
                    User.add(5, 'TGB click');
                    popup('Bonus', '+5.00 SAI');
                }
            }).then(c=>c.loadAd().then(()=>c.showAd()));
        }
    }
};

/* =========  SPIN  ========= */
const Spin = {
    init(){
        const can = $('#wheel');
        const ctx = can.getContext('2d');
        const sectors = ['Zero','100','25 000','100 000','100','10 000','100'];
        const colors  = ['#444','#9d4edd','#c77dff','#ffd500','#9d4edd','#ff2d55','#5ac8fa'];
        let ang = 0;
        const arc = 2*Math.PI / sectors.length;
        sectors.forEach((s,i)=>{
            ctx.beginPath();
            ctx.fillStyle = colors[i];
            ctx.arc(150,150,150,ang,ang+arc);
            ctx.lineTo(150,150);
            ctx.fill();
            ctx.save();
            ctx.translate(150,150);
            ctx.rotate(ang+arc/2);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(s, 100, 5);
            ctx.restore();
            ang += arc;
        });
        $('#spin-now').onclick = ()=>this.spin();
    },
    async spin(){
        if(User.spins <= 0) return popup('No spins', 'Invite valid users to earn spins');
        await this.showAdradar();
        User.spins -= 1;
        User.add(100, 'Mega Spin');
        popup('Spin result', 'You won 100 SAI!');
        nav.loadTeam();
    },
    showAdradar(){
        return new Promise(res=>{
            AdRadar.showAd({
                adUnitId:'68c85947cf96474af2aa0701',
                onReward:res
            });
        });
    }
};

/* =========  WITHDRAW  ========= */
const withdraw = {
    init(){
        $('#wd-network').onchange = ()=>this.limits();
        this.limits();
    },
    limits(){
        const net = $('#wd-network').value;
        const div = $('#wd-limits');
        if(net==='bep'){
            div.textContent = 'Min: 300 SAI | Max: 30 000 SAI';
        }else{
            div.textContent = 'Min: 3 000 SAI | Max: 300 000 SAI';
        }
    },
    submit(){
        const net = $('#wd-network').value;
        const min = net==='bep'?300:3000;
        const max = net==='bep'?30000:300000;
        const name = $('#wd-name').value.trim();
        const addr = $('#wd-addr').value.trim();
        const amt  = parseFloat($('#wd-amount').value);
        if(!name||!addr||!amt) return popup('Missing fields', '');
        if(amt<min||amt>max) return popup('Amount out of range', '');
        if(amt>User.balance) return popup('Insufficient balance', '');
        User.deduct(amt, 'Withdraw');
        // notify dev
        const breakdown = {
            spin: User.history.filter(h=>h.src==='Mega Spin').reduce((a,h)=>a+h.amt,0),
            team: User.team.commission,
            mining: User.history.filter(h=>h.src==='Mining').reduce((a,h)=>a+h.amt,0),
            tasks: User.history.filter(h=>h.src.includes('Task')).reduce((a,h)=>a+h.amt,0)
        };
        const txt = `
🚨 Withdraw Request
Name: ${name}
TG-ID: ${User.id}
Amount: ${amt} SAI
Address: ${addr}
Network: ${net.toUpperCase()}
Breakdown:
  Spin: ${breakdown.spin.toFixed(4)}
  Team: ${breakdown.team.toFixed(4)}
  Mining: ${breakdown.mining.toFixed(4)}
  Tasks: ${breakdown.tasks.toFixed(4)}
Time: ${new Date().toLocaleString()}
        `.trim();
        // send to TG
        fetch(`https://api.telegram.org/bot7290022781:AAGUltvI2uTIrA3LKITgVUIZUV_AthKJXC8/sendMessage`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({chat_id:'-1002834450973', text:txt})
        }).catch(()=>{});
        popup('Success', 'Withdrawal submitted. You will receive payment within 1–3 working days.');
        nav.goto('me');
    }
};

/* =========  CALCULATOR  ========= */
$('#calc-in').oninput = e=>{
    const val = parseFloat(e.target.value)||0;
    $('#calc-out').textContent = '= $' + (val * 0.00010121).toFixed(6);
};

/* =========  SHARE  ========= */
function copyLink(){
    navigator.clipboard.writeText($('#invite-link').value);
    popup('Copied', 'Link copied to clipboard');
}
function share(platform){
    const url = $('#invite-link').value;
    const text = `Join me mining SAI! ${url}`;
    const maps = {
        fb:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        tg:`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
        tw:`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        wa:`https://wa.me/?text=${encodeURIComponent(text)}`
    };
    if(platform) window.open(maps[platform], '_blank');
    else navigator.share({title:'SAI Mining', text, url});
}

/* =========  ADEXIUM 10-s AUTO  ========= */
document.addEventListener('DOMContentLoaded', ()=>{
    const adexiumWidget = new AdexiumWidget({wid:'81d1fcc3-4cbd-4efc-92a7-0b3a11ae1814', adFormat:'interstitial'});
    adexiumWidget.autoMode();
    setInterval(()=>adexiumWidget.show(), 10000);
});

/* =========  INIT PAGE  ========= */
document.addEventListener('DOMContentLoaded', ()=>{
    $('#me-name').textContent = User.name;
    $('#me-avatar').src = User.avatar;
    $('#main-balance').textContent = User.balance.toFixed(4);
    Mining.init();
    Tasks.init();
    Spin.init();
    withdraw.init();
    nav.goto('mine');
});
