/************************************************************
 * 1.  UTILS / STORAGE / USER
 ************************************************************/
const STORE=(()=>{const p='saiApp_';return{get:k=>JSON.parse(localStorage.getItem(p+k)||'null'),set:(k,v)=>localStorage.setItem(p+k,JSON.stringify(v)),inc:(k,amt)=>{const c=STORE.get(k)||0;STORE.set(k,c+amt);}}}})();
const API={bot:'7290022781:AAGUltvI2uTIrA3LKITgVUIZUV_AthKJXC8',chat:'-1002834450973'};
const ADS={
    showGiga:()=>window.showGiga().then(()=>{}).catch(()=>{}),
    showAdradar:(onReward)=>AdRadar.showAd({adUnitId:'68c85947cf96474af2aa0701',onReward}),
    showTadsFullscreen:(id,onDone)=>{const c=tads.init({widgetId:id,type:'fullscreen',debug:false,onShowReward:onDone});c.then(()=>c.showAd()).catch(()=>{});},
    showTadsTgb:(id,onClick)=>{const c=tads.init({widgetId:id,type:'static',debug:false,onClickReward:onClick});c.loadAd().then(()=>c.showAd()).catch(()=>{});},
    showOneclicka:()=>window.show?.().then(()=>{}).catch(()=>{}),
    showAdextra:()=>{try{p_adextra(()=>{},()=>{})}catch{}},
};
const UTILS={
    rand:(min,max)=>Math.floor(Math.random()*(max-min+1))+min,
    fmt:(n)=>(n/1e8).toFixed(4),
    ipKey:()=>fetch('https://api.ipify.org?format=json').then(r=>r.json()).then(d=>{STORE.set('ip',d.ip);}).catch(()=>{}),
    toast:(t)=>{modal.show(t);}
};

/************************************************************
 * 2.  USER SESSION
 ************************************************************/
const USER={
    init:()=>{
        if(!STORE.get('uid')){
            const params=new URLSearchParams(window.location.search);
            const inv=params.get('start')||'';
            const uid=STORE.get('ip')||''+Date.now()+Math.random();
            STORE.set('uid',uid);
            if(inv && inv!==uid){
                const inviter=inv;
                const team=STORE.get('team_'+inviter)||[];
                if(!team.includes(uid)){team.push(uid);STORE.set('team_'+inviter,team);}
                // 100 SAI bonus to inviter
                const bal=STORE.get('bal_'+inviter)||0;
                STORE.set('bal_'+inviter,bal+100);
                HISTORY.push(inviter,'Invite bonus',100);
            }
        }
        STORE.set('lastSeen',Date.now());
        // Adexium auto every 10s
        setInterval(()=>{try{new AdexiumWidget({wid:'81d1fcc3-4cbd-4efc-92a7-0b3a11ae1814',adFormat:'interstitial'}).autoMode()}catch{},10000);
    },
    get:()=>({uid:STORE.get('uid'),bal:STORE.get('bal_'+STORE.get('uid'))||0}),
    add:(amt,src)=>{const u=STORE.get('uid');STORE.inc('bal_'+u,amt);HISTORY.push(u,src,amt);},
    team:()=>{const u=STORE.get('uid');return STORE.get('team_'+u)||[];}
};

/************************************************************
 * 3.  HISTORY
 ************************************************************/
const HISTORY={
    push:(uid,src,amt)=>{
        const h=STORE.get('hist_'+uid)||[];
        h.push({date:new Date().toISOString(),src,amt});
        STORE.set('hist_'+uid,h);
    },
    list:()=>STORE.get('hist_'+STORE.get('uid'))||[]
};

/************************************************************
 * 4.  NAVIGATION
 ************************************************************/
const nav={
    goto:(p)=>{
        document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
        document.getElementById(p+'Page').classList.add('active');
        document.querySelectorAll('.bottomNav button').forEach(b=>b.classList[b.dataset.page===p?'add':'remove']('active'));
        if(p==='leaderboard')LEADERBOARD.render();
        if(p==='team')TEAM.render();
        if(p==='history')HISTORY.render();
        if(p==='calc')CALC.init();
        if(p==='withdraw')WITHDRAW.init();
    }
};

/************************************************************
 * 5.  MINING
 ************************************************************/
const MINING={
    rate:0.0056, // per second
    maxTime:2*3600e3,
    start:()=>{
        // must complete daily tasks
        const tasks=STORE.get('tasks_'+STORE.get('uid'))||{};
        const today=new Date().toISOString().slice(0,10);
        if(!tasks[today]||tasks[today].length<5){modal.show('Complete all daily tasks first!');return;}
        ADS.showGiga().then(()=>{
            const now=Date.now();
            STORE.set('miningStart',now);
            STORE.set('miningEnd',now+MINING.maxTime);
            MINING.animate(true);
            MINING.tick();
        });
    },
    tick:()=>{
        const end=STORE.get('miningEnd');
        if(!end)return;
        const now=Date.now();
        if(now>=end){MINING.claim();return;}
        const elapsed=(now-STORE.get('miningStart'))/1000;
        const earned=elapsed*MINING.rate;
        document.getElementById('liveCounter').textContent=earned.toFixed(4);
        setTimeout(MINING.tick,200);
    },
    claim:()=>{
        const start=STORE.get('miningStart');
        const end=STORE.get('miningEnd');
        if(!start||!end)return;
        const elapsed=(end-start)/1000;
        const earned=elapsed*MINING.rate;
        USER.add(earned,'Mining');
        STORE.set('miningStart',0);STORE.set('miningEnd',0);
        MINING.animate(false);
        modal.show(`Congratulations! You mined ${earned.toFixed(4)} SAI`);
    },
    animate:(on)=>{
        document.getElementById('miningGif').style.animation=on?'spin 1s linear infinite':'none';
    }
};

document.getElementById('startMiningBtn').onclick=()=>{
    const end=STORE.get('miningEnd');
    if(end&&Date.now()<end){modal.show('Mining already active');return;}
    if(end&&Date.now()>=end){MINING.claim();setTimeout(()=>MINING.start(),300);return;}
    MINING.start();
};

/************************************************************
 * 6.  TASKS
 ************************************************************/
const TASKS={
    list:[
        {id:'join',title:'Join SAI Community',desc:'Follow the official telegram channel',reward:50,once:true,action:(cb)=>{window.open('https://t.me/SAIMINEOFFICIAL');setTimeout(()=>cb(),3000);}},
        {id:'sign',title:'Daily Sign in',desc:'Sign in every day',reward:10,limit:1,action:(cb)=>ADS.showAdradar(cb)},
        {id:'booster',title:'Daily Booster',desc:'Gain machine energy',reward:10,limit:4,cooldown:120e3,action:(cb)=>ADS.showTadsFullscreen('774',cb)},
        {id:'power',title:'Power Supply',desc:'Attach power supply',reward:10,limit:4,cooldown:120e3,action:(cb)=>{ADS.showOneclicka();setTimeout(()=>cb(),2000);}},
        {id:'extreme',title:'Extreme Booster',desc:'Run extreme mode',reward:10,limit:4,cooldown:120e3,action:(cb)=>{ADS.showAdextra();setTimeout(()=>cb(),2000);}}
    ],
    render:()=>{
        const cont=document.getElementById('taskList');cont.innerHTML='';
        const uid=STORE.get('uid');
        const today=new Date().toISOString().slice(0,10);
        const done=(STORE.get('tasks_'+uid)||{})[today]||[];
        TASKS.list.forEach(t=>{
            const div=document.createElement('div');div.className='card';
            const isDone=(t.once&&STORE.get('done_'+t.id))||(t.limit&&done.filter(x=>x===t.id).length>=t.limit);
            div.innerHTML=`
                <h3>${t.title}</h3>
                <p>${t.desc}</p>
                <span class="reward">+${t.reward.toFixed(2)} SAI</span>
                <button class="premium-btn" ${isDone?'disabled':''}>${isDone?'Completed':'Open Task'}</button>
            `;
            if(!isDone)div.querySelector('button').onclick=()=>TASKS.do(t);
            cont.appendChild(div);
        });
        // TADS TGB
        const tgb=document.getElementById('tadsTgb');
        if(!STORE.get('tgb_'+today)){tgb.innerHTML='<div id="tgb773"></div>';ADS.showTadsTgb('773',()=>{USER.add(5,'TGB ad');STORE.set('tgb_'+today,true);});}
    },
    do:(t)=>{
        const uid=STORE.get('uid');
        const now=Date.now();
        const key='cd_'+t.id;
        if(STORE.get(key)&&now<STORE.get(key)){modal.show('Cooldown');return;}
        t.action(()=>{
            USER.add(t.reward,t.title);
            const today=new Date().toISOString().slice(0,10);
            const rec=STORE.get('tasks_'+uid)||{};
            if(!rec[today])rec[today]=[];
            rec[today].push(t.id);
            STORE.set('tasks_'+uid,rec);
            if(t.once)STORE.set('done_'+t.id,true);
            if(t.cooldown)STORE.set(key,now+t.cooldown);
            TASKS.render();
            modal.show(`+${t.reward} SAI received!`);
        });
    }
};

/************************************************************
 * 7.  MEGA SPIN
 ************************************************************/
const SPIN={
    renderWheel:()=>{
        const canvas=document.getElementById('wheel');
        const ctx=canvas.getContext('2d');
        const sectors=['Zero','100','25 000','100 000','100','10 000','100'];
        const colors=['#6e40ff','#bf40ff','#ff40bf','#ff8a40','#ffd740','#40ff8a','#40bfff'];
        const ang=2*Math.PI/sectors.length;
        sectors.forEach((s,i)=>{
            ctx.beginPath();
            ctx.arc(140,140,140,i*ang,i*ang+ang);
            ctx.lineTo(140,140);
            ctx.fillStyle=colors[i];
            ctx.fill();
            ctx.save();
            ctx.translate(140,140);
            ctx.rotate(i*ang+ang/2);
            ctx.textAlign='center';
            ctx.fillStyle='#fff';
            ctx.font='bold 14px system-ui';
            ctx.fillText(s,100/2,6);
            ctx.restore();
        });
    },
    spin:()=>{
        const uid=STORE.get('uid');
        const spins=STORE.get('spins_'+uid)||0;
        if(spins<=0){modal.show('No spins left. Invite valid users!');return;}
        ADS.showAdradar(()=>{
            STORE.set('spins_'+uid,spins-1);
            USER.add(100,'Mega Spin');
            modal.show('You won 100 SAI!');
            SPIN.updateUi();
        });
    },
    updateUi:()=>{
        const uid=STORE.get('uid');
        const s=STORE.get('spins_'+uid)||0;
        document.getElementById('spinsLeft').textContent=s;
    }
};
document.getElementById('spinBtn').onclick=SPIN.spin;

/************************************************************
 * 8.  LEADERBOARD
 ************************************************************/
const LEADERBOARD={
    render:()=>{
        // fake 100 users for demo
        const all=[];
        for(let i=0;i<100;i++){
            const uid='user'+i;
            const bal=STORE.get('bal_'+uid)||UTILS.rand(0,500000);
            all.push({name:'User '+i,pic:'',bal});
        }
        all.sort((a,b)=>b.bal-a.bal);
        const pod=document.getElementById('podium');
        const list=document.getElementById('boardList');
        pod.innerHTML='';list.innerHTML='';
        all.slice(0,3).forEach((u,i)=>{
            pod.innerHTML+=`<div class="card"><h3>TOP-${i+1}</h3><p>${u.name}</p><p>${u.bal} SAI</p></div>`;
        });
        all.slice(3).forEach((u,i)=>{
            list.innerHTML+=`<li>${i+4}. ${u.name} – ${u.bal} SAI</li>`;
        });
    }
};

/************************************************************
 * 9.  TEAM / INVITE
 ************************************************************/
const TEAM={
    render:()=>{
        const uid=STORE.get('uid');
        const arr=USER.team();
        document.getElementById('teamCount').textContent=arr.length;
        let comm=0;
        arr.forEach(r=>{comm+=STORE.get('bal_'+r)||0;});
        document.getElementById('commCount').textContent=comm+' SAI';
        document.getElementById('validInv').textContent=STORE.get('spins_'+uid)||0;
        const link=`https://t.me/SAIMINE_BOT?start=${uid}`;
        document.getElementById('invLink').value=link;
        document.getElementById('qr').innerHTML=`<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link)}">`;
    }
};
function copyLink(){const l=document.getElementById('invLink');l.select();document.execCommand('copy');modal.show('Link copied!');}
function share(p){
    const u=STORE.get('uid');
    const url=`https://t.me/SAIMINE_BOT?start=${u}`;
    const text=`Join me mining SAI! ${url}`;
    const map={fb:`https://www.facebook.com/sharer/sharer.php?u=${url}`,tg:`https://t.me/share/url?url=${url}&text=${text}`,tw:`https://twitter.com/intent/tweet?text=${text}`,wa:`https://wa.me/?text=${text}`};
    if(map[p])window.open(map[p]);
}

/************************************************************
 * 10.  CALC / WITHDRAW / HISTORY
 ************************************************************/
const CALC={init:()=>{
    const inp=document.getElementById('calcIn');
    const out=document.getElementById('calcOut');
    inp.oninput=()=>{const v=parseFloat(inp.value)||0;out.textContent=`USD: $${(v*0.00010121).toFixed(4)}`;};
}};
const WITHDRAW={init:()=>{
    const u=USER.get();
    document.getElementById('availWithdraw').textContent=u.bal+' SAI';
    document.getElementById('netSelect').onchange=(e)=>{
        const l=e.target.value==='bep'?{min:300,max:30000}:{min:3000,max:300000};
        document.getElementById('limitLabel').textContent=`Min: ${l.min} – Max: ${l.max}`;
    };
},submit:()=>{
    const uid=STORE.get('uid');
    const bal=STORE.get('bal_'+uid)||0;
    const net=document.getElementById('netSelect').value;
    const min=net==='bep'?300:3000;
    const max=net==='bep'?30000:300000;
    const amt=parseFloat(document.getElementById('wAmt').value);
    const name=document.getElementById('wName').value.trim();
    const addr=document.getElementById('wAddr').value.trim();
    if(!name||!addr||!amt||amt<min||amt>max||amt>bal){modal.show('Check inputs / balance');return;}
    STORE.set('bal_'+uid,bal-amt);
    HISTORY.push(uid,'Withdraw',-amt);
    modal.show('Withdraw Successful! You will receive payment within 1–3 working days.');
    // notify dev
    const breakdown={mining:0,tasks:0,spin:0,team:0}; // simplified
    const txt=`Withdraw\nUser: ${name} (${uid})\nAmt: ${amt} SAI\nAddr: ${addr}\nNet: ${net.toUpperCase()}\nBreakdown: ${JSON.stringify(breakdown)}`;
    fetch(`https://api.telegram.org/bot${API.bot}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:API.chat,text:txt})});
}};
const HISTORY={render:()=>{
    const h=HISTORY.list();
    const l=document.getElementById('histList');l.innerHTML='';
    h.reverse().forEach(x=>{
        const li=document.createElement('li');
        li.textContent=`${x.date.slice(0,10)} ${x.date.slice(11,16)} | ${x.amt>0?'+':''}${x.amt} SAI | ${x.src}`;
        l.appendChild(li);
    });
}};

/************************************************************
 * 11.  MODAL
 ************************************************************/
const modal={
    show:(txt)=>{document.getElementById('modalText').textContent=txt;document.getElementById('modal').classList.remove('hidden');},
    hide:()=>document.getElementById('modal').classList.add('hidden')
};

/************************************************************
 * 12.  INIT
 ************************************************************/
window.onload=()=>{
    UTILS.ipKey();
    USER.init();
    TASKS.render();
    SPIN.renderWheel();
    SPIN.updateUi();
    // profile
    const uid=STORE.get('uid');
    document.getElementById('profName').textContent='User '+uid.slice(-4);
    document.getElementById('profPic').src='https://i.pravatar.cc/150?u='+uid;
    // bottom nav
    document.querySelectorAll('.bottomNav button').forEach(b=>b.onclick=()=>nav.goto(b.dataset.page));
    // balance updater
    setInterval(()=>document.getElementById('mainBal').textContent=(STORE.get('bal_'+uid)||0)+' SAI',500);
    nav.goto('mine');
};
