import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Check, ChevronDown,
  ChevronRight, CircleHelp, Clock3, Command, Compass, Cpu, FileSearch, Filter,
  Gauge, GitBranch, Layers3, MapPin, Menu, Plus, RadioTower, Route, Search,
  ShieldAlert, Siren, SlidersHorizontal, Sparkles, Waves, X, Zap, CheckCircle2,
  CircleDot, RefreshCw, ArrowRight, PanelLeftClose, Network, ScanSearch
} from "lucide-react";
import { dijkstra, kmpSearch, prioritizeIncidents, analyzeNetwork, greedyResourceAllocation, kruskalMST } from "./algorithms.js";

const initialIncidents = [
  { id:"INC-2048", title:"Traffic signal failure", area:"Central Avenue", category:"Traffic", severity:"Critical", status:"Active", team:"Traffic Control", age:"4 min ago", createdAt:"2026-10-16T10:12:00" },
  { id:"INC-2047", title:"Water pipeline pressure drop", area:"Lakeview District", category:"Utilities", severity:"High", status:"Assigned", team:"Water Operations", age:"12 min ago", createdAt:"2026-10-16T10:04:00" },
  { id:"INC-2046", title:"Streetlight outage reported", area:"North Park", category:"Power", severity:"Medium", status:"Active", team:"Electrical Services", age:"19 min ago", createdAt:"2026-10-16T09:57:00" },
  { id:"INC-2045", title:"Road obstruction", area:"Market Street", category:"Roads", severity:"High", status:"Assigned", team:"Road Maintenance", age:"27 min ago", createdAt:"2026-10-16T09:49:00" },
  { id:"INC-2044", title:"Waste collection delay", area:"East Quarter", category:"Sanitation", severity:"Low", status:"Resolved", team:"Sanitation", age:"43 min ago", createdAt:"2026-10-16T09:33:00" }
];

const initialComplaints = [
  { id:"CMP-891", resident:"Resident #2841", area:"Central Avenue", category:"Traffic", text:"The traffic signal at Central Avenue and 4th Street has stopped working. Vehicles are backing up near the crossing.", status:"Under review", time:"09:48 AM" },
  { id:"CMP-890", resident:"Resident #1930", area:"Lakeview District", category:"Water", text:"Low water pressure in the Lakeview pipeline since early morning. Please inspect the water line.", status:"Assigned", time:"09:32 AM" },
  { id:"CMP-889", resident:"Resident #5508", area:"North Park", category:"Lighting", text:"Street light on the north park walkway is not working after sunset.", status:"Under review", time:"09:17 AM" },
  { id:"CMP-888", resident:"Resident #4270", area:"Central Avenue", category:"Traffic", text:"Traffic light failure at Central Avenue crossing is causing a long queue.", status:"Duplicate candidate", time:"09:06 AM" }
];

const locations = [
  {id:"civic", name:"Civic Centre", x:47, y:47},
  {id:"central", name:"Central Avenue", x:29, y:33},
  {id:"lake", name:"Lakeview", x:67, y:23},
  {id:"north", name:"North Park", x:48, y:13},
  {id:"market", name:"Market Street", x:75, y:55},
  {id:"east", name:"East Quarter", x:82, y:79},
  {id:"hospital", name:"City Hospital", x:24, y:75},
  {id:"depot", name:"Response Depot", x:48, y:87}
];
const roadEdges = [
  ["civic","central",4],["civic","lake",5],["civic","market",6],["civic","hospital",7],
  ["civic","north",4],["central","north",5],["central","hospital",4],["lake","north",3],
  ["lake","market",4],["market","east",3],["east","depot",5],["depot","hospital",4],
  ["depot","civic",3],["central","lake",7]
];
const roadGraph = Object.fromEntries(locations.map(l => [l.id, []]));
roadEdges.forEach(([a,b,w]) => { roadGraph[a].push({to:b,weight:w}); roadGraph[b].push({to:a,weight:w}); });
const fmtTime = () => new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});

function IconButton({children, onClick, title, className=""}) {
  return <button className={`icon-btn ${className}`} title={title} onClick={onClick}>{children}</button>;
}
function Pill({children, tone="neutral"}) { return <span className={`pill pill-${tone}`}>{children}</span>; }
function SectionTitle({eyebrow, title, subtitle, action}) {
  return <div className="section-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
function MetricCard({label,value,change,icon:Icon,tone,caption}) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={18}/></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot"><span className={change?.startsWith("+") ? "positive" : "muted"}>{change}</span><span>{caption}</span></div></div>;
}
function CityMap({activeIncident, routePath=[], onSelect}) {
  const pointById = Object.fromEntries(locations.map(l => [l.id,l]));
  const routeSet = new Set(routePath);
  return <div className="city-map">
    <div className="map-topline"><span><span className="live-dot"/> LIVE CITY NETWORK</span><span className="map-scale">SCHEMATIC · NOT TO SCALE</span></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="Schematic map of city locations and road connections" className="map-svg">
      <defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#273542" strokeWidth=".13"/></pattern></defs>
      <rect width="100" height="100" fill="url(#grid)"/>
      <path d="M 0 61 C 18 58, 28 64, 38 58 S 62 51, 100 61" stroke="#173d48" strokeWidth="4.5" fill="none" opacity=".8"/>
      <path d="M 0 61 C 18 58, 28 64, 38 58 S 62 51, 100 61" stroke="#245868" strokeWidth=".35" fill="none"/>
      <path d="M 8 0 L 18 100 M 60 0 L 56 100 M 0 39 L 100 34 M 0 88 L 100 90" stroke="#1b2b38" strokeWidth="1.4" fill="none"/>
      {roadEdges.map(([a,b,w],i)=> {
        const p1=pointById[a], p2=pointById[b], route=routeSet.has(a)&&routeSet.has(b)&&Math.abs(routePath.indexOf(a)-routePath.indexOf(b))===1;
        return <g key={i}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={route?"#51e0bd":"#344551"} strokeWidth={route?"1.15":".55"} strokeLinecap="round"/>{route&&<line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#51e0bd" strokeWidth=".28" strokeDasharray="1 1"/>}</g>
      })}
      {locations.map(l => {
        const incident = activeIncident && (activeIncident.area.toLowerCase().includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(activeIncident.area.toLowerCase().split(" ")[0]));
        return <g key={l.id} onClick={()=>onSelect?.(l)} style={{cursor:"pointer"}}>
          {incident && <circle cx={l.x} cy={l.y} r="4.3" fill="#ff6d70" opacity=".17"><animate attributeName="r" values="3;5;3" dur="2.2s" repeatCount="indefinite"/></circle>}
          <circle cx={l.x} cy={l.y} r={routeSet.has(l.id)?"2.2":"1.8"} fill={routeSet.has(l.id)?"#51e0bd":incident?"#ff6d70":"#89a1b2"} stroke="#101820" strokeWidth=".6"/>
          <text x={l.x+2.4} y={l.y-2.3} fill={routeSet.has(l.id)?"#c7fff0":"#b8c9d4"} fontSize="2.7" fontWeight="500">{l.name}</text>
        </g>
      })}
    </svg>
    <div className="map-legend"><span><i className="legend-dot mint"/>Optimized route</span><span><i className="legend-dot red"/>Incident area</span><span><i className="legend-dot gray"/>City location</span></div>
  </div>;
}

function App() {
  const [page,setPage] = useState("overview");
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [incidents,setIncidents] = useState(() => {
    try { const saved = localStorage.getItem("smartcityx-incidents-v1"); return saved ? JSON.parse(saved) : initialIncidents; }
    catch { return initialIncidents; }
  });
  const [complaints,setComplaints] = useState(() => {
    try { const saved = localStorage.getItem("smartcityx-complaints-v1"); return saved ? JSON.parse(saved) : initialComplaints; }
    catch { return initialComplaints; }
  });
  useEffect(() => { try { localStorage.setItem("smartcityx-incidents-v1", JSON.stringify(incidents)); } catch {} }, [incidents]);
  useEffect(() => { try { localStorage.setItem("smartcityx-complaints-v1", JSON.stringify(complaints)); } catch {} }, [complaints]);
  const [toast,setToast] = useState("");
  const [query,setQuery] = useState("");
  const [incidentFilter,setIncidentFilter] = useState("All");
  const [showIncidentModal,setShowIncidentModal] = useState(false);
  const [showComplaintModal,setShowComplaintModal] = useState(false);
  const [selectedIncident,setSelectedIncident] = useState(initialIncidents[0]);
  const [from,setFrom] = useState("depot");
  const [to,setTo] = useState("central");
  const [routeResult,setRouteResult] = useState(null);
  const [complaintSearch,setComplaintSearch] = useState("traffic signal");
  const [complaintSearchResult,setComplaintSearchResult] = useState(null);
  const [units,setUnits] = useState(5);
  const [resourcePlan,setResourcePlan] = useState(null);
  const [newIncident,setNewIncident] = useState({title:"",area:"",category:"Traffic",severity:"Medium"});
  const [newComplaint,setNewComplaint] = useState({area:"",category:"Traffic",text:""});
  const [searchOpen,setSearchOpen] = useState(false);
  const [globalSearch,setGlobalSearch] = useState("");
  const [notificationsOpen,setNotificationsOpen] = useState(false);

  const activeIncidents = incidents.filter(i=>i.status!=="Resolved");
  const orderedIncidents = useMemo(()=>prioritizeIncidents(incidents),[incidents]);
  const networkReport = useMemo(()=>analyzeNetwork(locations,roadEdges.map(([from,to,weight])=>({from,to,weight}))),[]);
  const visibleIncidents = orderedIncidents.filter(i=>(incidentFilter==="All"||i.status===incidentFilter) && `${i.id} ${i.title} ${i.area} ${i.category}`.toLowerCase().includes(query.toLowerCase()));
  const filteredComplaints = complaints.filter(c=>`${c.id} ${c.area} ${c.text} ${c.category}`.toLowerCase().includes(query.toLowerCase()));
  const showToast = (message) => { setToast(message); window.setTimeout(()=>setToast(""),2800); };
  const navGroups = [
    {label:"WORKSPACE",items:[["overview","Overview",Gauge],["incidents","Incident Command",ShieldAlert],["routing","Route Optimizer",Route],["complaints","Complaint Intelligence",FileSearch],["infrastructure","Infrastructure",Network],["resources","Resource Allocation",Layers3]]},
  ];
  const currentTitle = ({overview:"City overview",incidents:"Incident command",routing:"Route optimizer",complaints:"Complaint intelligence",infrastructure:"Infrastructure network",resources:"Resource allocation"})[page];

  function resolveIncident(id) {
    setIncidents(old=>old.map(i=>i.id===id?{...i,status:"Resolved"}:i));
    showToast(`${id} marked as resolved`);
  }
  function createIncident(e) {
    e.preventDefault();
    if(!newIncident.title.trim()||!newIncident.area.trim()) return;
    const item={id:`INC-${2050+incidents.length}`,title:newIncident.title.trim(),area:newIncident.area.trim(),category:newIncident.category,severity:newIncident.severity,status:"Active",team:"Unassigned",age:"Just now",createdAt:new Date().toISOString()};
    setIncidents(old=>[item,...old]);setSelectedIncident(item);setNewIncident({title:"",area:"",category:"Traffic",severity:"Medium"});setShowIncidentModal(false);showToast("Incident created and added to the live queue");
  }
  function createComplaint(e) {
    e.preventDefault();
    if(!newComplaint.area.trim()||!newComplaint.text.trim()) return;
    const item={id:`CMP-${892+complaints.length}`,resident:"New resident report",area:newComplaint.area.trim(),category:newComplaint.category,text:newComplaint.text.trim(),status:"Under review",time:fmtTime()};
    setComplaints(old=>[item,...old]);setNewComplaint({area:"",category:"Traffic",text:""});setShowComplaintModal(false);showToast("Complaint received and indexed");
  }
  function runRoute() {
    const result=dijkstra(roadGraph,from,to);
    setRouteResult(result);
    if(result.path.length) showToast(`Optimal route found · ${result.distance} min (sample network weight)`);
    else showToast("No connected route found for this pair");
  }
  function runComplaintSearch() {
    const results=complaints.map(c=>({complaint:c,...kmpSearch(c.text.toLowerCase(),complaintSearch.toLowerCase())})).filter(r=>r.matches.length>0);
    setComplaintSearchResult(results);
  }
  function runResourcePlan() {
    setResourcePlan(greedyResourceAllocation(incidents,Number(units)));
    showToast("Resource allocation plan calculated from current incident priorities");
  }

  return <div className={`app-shell ${sidebarOpen?"":"sidebar-collapsed"}`}>
    <aside className={`sidebar ${sidebarOpen?"":"collapsed"}`}>
      <div className="brand"><div className="brand-mark"><RadioTower size={21}/></div>{sidebarOpen&&<div className="brand-copy"><strong>SmartCity<span>X</span></strong><small>URBAN INTELLIGENCE</small></div>}<button className="collapse-btn" onClick={()=>setSidebarOpen(!sidebarOpen)} title="Toggle sidebar"><PanelLeftClose size={17}/></button></div>
      <div className="city-switcher"><div className="city-avatar">SC</div>{sidebarOpen&&<div className="city-copy"><strong>Metro District</strong><span><i className="live-dot"/> Systems operational</span></div>}{sidebarOpen&&<ChevronDown size={15} className="dim"/>}</div>
      {navGroups.map(g=><div className="nav-group" key={g.label}>{sidebarOpen&&<div className="nav-label">{g.label}</div>}{g.items.map(([id,label,Icon])=><button key={id} className={`nav-item ${page===id?"active":""}`} onClick={()=>setPage(id)} title={label}><Icon size={18}/>{sidebarOpen&&<><span>{label}</span>{id==="incidents"&&<b className="nav-count">{activeIncidents.length}</b>}</>}</button>)}</div>)}
      {sidebarOpen&&<div className="sidebar-bottom"><div className="status-card"><div className="status-head"><span className="status-light"/><strong>City systems healthy</strong></div><p>All core services responding normally.</p><div className="status-meter"><span/></div><div className="status-meta"><span>Service availability</span><b>99.94%</b></div></div><button className="help-link" onClick={()=>showToast("Help centre: use the workspace navigation to access city operations.")}><CircleHelp size={16}/> Help & documentation <ChevronRight size={14}/></button><div className="user-row"><div className="user-avatar">OP</div><div className="user-info"><strong>Operations Team</strong><span>City administrator</span></div><ChevronDown size={15}/></div></div>}
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><span>SmartCityX</span><ChevronRight size={14}/><strong>{currentTitle}</strong></div>
        <div className="top-actions">
          <div className="system-status"><span className="live-dot"/> All systems operational</div>
          <IconButton title="Search workspace" onClick={()=>setSearchOpen(!searchOpen)}><Search size={17}/></IconButton>
          <div className="notification-wrap"><IconButton title="Notifications" onClick={()=>setNotificationsOpen(!notificationsOpen)}><Bell size={17}/>{activeIncidents.length>0&&<i className="notification-dot"/>}</IconButton>{notificationsOpen&&<div className="notification-popover"><strong>Operations alerts</strong>{activeIncidents.slice(0,3).map(i=><div className="notification-item" key={i.id}><span className={`severity-dot ${i.severity.toLowerCase()}`}/><div><b>{i.title}</b><small>{i.area} · {i.age}</small></div></div>)}<button className="text-btn" onClick={()=>{setPage("incidents");setNotificationsOpen(false)}}>Open incident command <ArrowRight size={13}/></button></div>}</div>
          <div className="top-avatar">OP</div>
        </div>
        {searchOpen&&<div className="global-search"><Search size={16}/><input autoFocus placeholder="Search incidents, areas, complaints…" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setQuery(globalSearch);setPage("incidents");setSearchOpen(false)}}}/><button onClick={()=>setSearchOpen(false)}><X size={15}/></button><span>ENTER TO SEARCH</span></div>}
      </header>

      <div className="page-content">
        {page==="overview"&&<Overview incidents={incidents} activeIncidents={activeIncidents} orderedIncidents={orderedIncidents} setPage={setPage} setSelectedIncident={setSelectedIncident} showIncidentModal={()=>setShowIncidentModal(true)} resolveIncident={resolveIncident} routePath={routeResult?.path||[]} networkReport={networkReport} />}
        {page==="incidents"&&<IncidentsPage incidents={visibleIncidents} filter={incidentFilter} setFilter={setIncidentFilter} query={query} setQuery={setQuery} onAdd={()=>setShowIncidentModal(true)} onResolve={resolveIncident} onSelect={i=>{setSelectedIncident(i);showToast(`${i.id} selected`)}} />}
        {page==="routing"&&<RoutingPage from={from} setFrom={setFrom} to={to} setTo={setTo} result={routeResult} runRoute={runRoute}/>}
        {page==="complaints"&&<ComplaintsPage complaints={filteredComplaints} query={query} setQuery={setQuery} search={complaintSearch} setSearch={setComplaintSearch} result={complaintSearchResult} runSearch={runComplaintSearch} onAdd={()=>setShowComplaintModal(true)} />}
        {page==="infrastructure"&&<InfrastructurePage networkReport={networkReport}/>}
        {page==="resources"&&<ResourcesPage incidents={incidents} units={units} setUnits={setUnits} result={resourcePlan} run={runResourcePlan}/>}
      </div>
      <footer className="footer"><span>SMARTCITYX <span className="footer-sep">/</span> URBAN OPERATIONS PLATFORM</span><span>DEMO ENVIRONMENT <i className="live-dot"/> <span>{fmtTime()}</span></span></footer>
    </main>

    {showIncidentModal&&<Modal title="Create incident" subtitle="Register a new city operations issue." onClose={()=>setShowIncidentModal(false)}><form className="modal-form" onSubmit={createIncident}><label>Incident title<input required value={newIncident.title} onChange={e=>setNewIncident({...newIncident,title:e.target.value})} placeholder="e.g. Road flooding near junction"/></label><label>Area / location<input required value={newIncident.area} onChange={e=>setNewIncident({...newIncident,area:e.target.value})} placeholder="e.g. Riverside Junction"/></label><div className="form-grid"><label>Category<select value={newIncident.category} onChange={e=>setNewIncident({...newIncident,category:e.target.value})}>{["Traffic","Utilities","Power","Roads","Sanitation","Public Safety"].map(v=><option key={v}>{v}</option>)}</select></label><label>Severity<select value={newIncident.severity} onChange={e=>setNewIncident({...newIncident,severity:e.target.value})}>{["Critical","High","Medium","Low"].map(v=><option key={v}>{v}</option>)}</select></label></div><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setShowIncidentModal(false)}>Cancel</button><button className="btn primary"><Plus size={15}/> Create incident</button></div></form></Modal>}
    {showComplaintModal&&<Modal title="Submit city complaint" subtitle="Add a report to the complaint intelligence queue." onClose={()=>setShowComplaintModal(false)}><form className="modal-form" onSubmit={createComplaint}><label>Area / location<input required value={newComplaint.area} onChange={e=>setNewComplaint({...newComplaint,area:e.target.value})} placeholder="Neighborhood or street"/></label><label>Category<select value={newComplaint.category} onChange={e=>setNewComplaint({...newComplaint,category:e.target.value})}>{["Traffic","Water","Lighting","Roads","Sanitation","Other"].map(v=><option key={v}>{v}</option>)}</select></label><label>Complaint details<textarea required rows="4" value={newComplaint.text} onChange={e=>setNewComplaint({...newComplaint,text:e.target.value})} placeholder="Describe the issue…"/></label><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setShowComplaintModal(false)}>Cancel</button><button className="btn primary"><Plus size={15}/> Submit complaint</button></div></form></Modal>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function Overview({incidents,activeIncidents,orderedIncidents,setPage,setSelectedIncident,showIncidentModal,resolveIncident,routePath,networkReport}) {
  const critical=activeIncidents.filter(i=>i.severity==="Critical").length;
  return <>
    <SectionTitle eyebrow="FRIDAY, 16 OCTOBER 2026 · LIVE OPERATIONS" title="City overview" subtitle="Monitor incidents, coordinate response teams, and understand the city at a glance." action={<button className="btn primary" onClick={showIncidentModal}><Plus size={16}/> New incident</button>}/>
    <div className="metrics-grid">
      <MetricCard label="Active incidents" value={activeIncidents.length.toString().padStart(2,"0")} change={critical?`${critical} critical`:"No critical alerts"} caption="needs attention" icon={ShieldAlert} tone="coral"/>
      <MetricCard label="Resolved today" value={incidents.filter(i=>i.status==="Resolved").length.toString().padStart(2,"0")} change="+12%" caption="vs. previous day" icon={CheckCircle2} tone="mint"/>
      <MetricCard label="Response time" value="08.4 min" change="−1.2 min" caption="average today" icon={Clock3} tone="blue"/>
      <MetricCard label="Network health" value={networkReport.connected?"99.9%":"Degraded"} change={`${networkReport.components.length} connected region${networkReport.components.length===1?"":"s"}`} caption="road connectivity" icon={Activity} tone="violet"/>
    </div>
    <div className="overview-grid">
      <section className="panel map-panel"><div className="panel-heading"><div><h2>City network</h2><p>Operational view · Metro District</p></div><button className="subtle-btn" onClick={()=>setPage("routing")}>Optimize route <ArrowRight size={14}/></button></div><CityMap activeIncident={activeIncidents[0]} routePath={routePath}/><div className="map-bottom-stats"><div><span className="mini-label">CONNECTED LOCATIONS</span><strong>{locations.length}</strong></div><div><span className="mini-label">ROAD SEGMENTS</span><strong>{roadEdges.length}</strong></div><div><span className="mini-label">NETWORK STATUS</span><strong className="mint-text">Operational</strong></div></div></section>
      <section className="panel incident-panel"><div className="panel-heading"><div><h2>Priority queue</h2><p>Ranked by severity and urgency</p></div><button className="text-btn" onClick={()=>setPage("incidents")}>View all <ArrowRight size={13}/></button></div><div className="priority-list">{orderedIncidents.filter(i=>i.status!=="Resolved").slice(0,4).map((i,idx)=><div className="priority-item" key={i.id}><div className={`priority-rank ${i.severity.toLowerCase()}`}>{String(idx+1).padStart(2,"0")}</div><div className="priority-copy"><strong>{i.title}</strong><span><MapPin size={12}/>{i.area} · {i.age}</span><div className="priority-meta"><Pill tone={i.severity.toLowerCase()}>{i.severity}</Pill><span>{i.id}</span></div></div><button className="mini-action" title="Mark resolved" onClick={()=>resolveIncident(i.id)}><Check size={14}/></button></div>)}</div><button className="panel-bottom-action" onClick={showIncidentModal}><Plus size={14}/> Register a new incident</button></section>
    </div>
    <div className="bottom-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Service performance</h2><p>Response operations · Last 7 days</p></div><Pill tone="mint">Within target</Pill></div><div className="chart-area"><div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div><div className="chart-main"><div className="chart-gridlines"><i/><i/><i/><i/></div><svg viewBox="0 0 500 140" preserveAspectRatio="none" className="line-chart"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54d6b7" stopOpacity=".23"/><stop offset="100%" stopColor="#54d6b7" stopOpacity="0"/></linearGradient></defs><path d="M0 80 C30 72 35 55 70 62 S110 90 145 54 S190 48 215 58 S250 32 285 43 S325 57 355 35 S400 40 430 24 S470 31 500 14 L500 140 L0 140 Z" fill="url(#chartFill)"/><path d="M0 80 C30 72 35 55 70 62 S110 90 145 54 S190 48 215 58 S250 32 285 43 S325 57 355 35 S400 40 430 24 S470 31 500 14" fill="none" stroke="#54d6b7" strokeWidth="2.4" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x"><span>10 Oct</span><span>11 Oct</span><span>12 Oct</span><span>13 Oct</span><span>14 Oct</span><span>15 Oct</span><span>Today</span></div></div></div><div className="performance-footer"><div><span className="metric-dot mint-dot"/>Incident response SLA<strong>94.8%</strong></div><div><span className="metric-dot blue-dot"/>Service availability<strong>99.94%</strong></div></div></section>
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest operational updates</p></div><Activity size={17} className="dim"/></div><div className="activity-list">{[{icon:CheckCircle2,tone:"mint",title:"Waste collection delay resolved",sub:"East Quarter · INC-2044",time:"09:57"},{icon:Route,tone:"blue",title:"Route optimization completed",sub:"Response Depot → Central Avenue",time:"09:42"},{icon:Bell,tone:"coral",title:"New traffic incident flagged",sub:"Central Avenue · Critical",time:"09:36"},{icon:Waves,tone:"violet",title:"Water pressure anomaly detected",sub:"Lakeview District",time:"09:21"}].map((a,i)=><div className="activity-item" key={i}><div className={`activity-icon ${a.tone}`}><a.icon size={15}/></div><div className="activity-copy"><strong>{a.title}</strong><span>{a.sub}</span></div><time>{a.time}</time></div>)}</div></section>
    </div>
  </>;
}

function IncidentsPage({incidents,filter,setFilter,query,setQuery,onAdd,onResolve,onSelect}) {
  return <><SectionTitle eyebrow="CITY OPERATIONS / INCIDENTS" title="Incident command" subtitle="Triage reports, track response status, and resolve urban service disruptions." action={<button className="btn primary" onClick={onAdd}><Plus size={16}/> New incident</button>}/><div className="metrics-grid compact-metrics"><MetricCard label="Open incidents" value={incidents.filter(i=>i.status!=="Resolved").length} change="Live queue" caption="across city" icon={AlertTriangle} tone="coral"/><MetricCard label="Critical priority" value={incidents.filter(i=>i.severity==="Critical"&&i.status!=="Resolved").length} change="Immediate" caption="response required" icon={Siren} tone="violet"/><MetricCard label="Assigned teams" value={new Set(incidents.map(i=>i.team).filter(t=>t!=="Unassigned")).size} change="Active teams" caption="on the roster" icon={RadioTower} tone="blue"/></div><section className="panel table-panel"><div className="table-toolbar"><div className="tabs">{["All","Active","Assigned","Resolved"].map(f=><button key={f} className={filter===f?"selected":""} onClick={()=>setFilter(f)}>{f}</button>)}</div><div className="toolbar-search"><Search size={15}/><input placeholder="Search incidents…" value={query} onChange={e=>setQuery(e.target.value)}/><SlidersHorizontal size={15}/></div></div><div className="table-scroll"><table><thead><tr><th>INCIDENT</th><th>LOCATION</th><th>SEVERITY</th><th>ASSIGNED TEAM</th><th>STATUS</th><th>REPORTED</th><th></th></tr></thead><tbody>{incidents.map(i=><tr key={i.id}><td><button className="table-title" onClick={()=>onSelect(i)}><strong>{i.title}</strong><span>{i.id} · {i.category}</span></button></td><td><span className="location-cell"><MapPin size={13}/>{i.area}</span></td><td><Pill tone={i.severity.toLowerCase()}><i className={`severity-dot ${i.severity.toLowerCase()}`}/>{i.severity}</Pill></td><td>{i.team==="Unassigned"?<Pill tone="warning">Unassigned</Pill>:i.team}</td><td><Pill tone={i.status==="Resolved"?"mint":i.status==="Assigned"?"blue":"warning"}>{i.status}</Pill></td><td className="muted-cell">{i.age}</td><td>{i.status!=="Resolved"&&<button className="resolve-btn" title="Resolve incident" onClick={()=>onResolve(i.id)}><Check size={14}/></button>}</td></tr>)}</tbody></table>{incidents.length===0&&<div className="empty-state"><Search size={22}/><strong>No incidents found</strong><span>Try changing the filter or search query.</span></div>}</div><div className="table-footer"><span>Showing <b>{incidents.length}</b> incident records</span><span>Priority sorted · <span className="mint-text">Live data</span></span></div></section></>;
}

function RoutingPage({from,setFrom,to,setTo,result,runRoute}) {
  const [step,setStep] = useState(0);
  const chosenStep = result?.steps?.[Math.min(step,Math.max(0,(result?.steps?.length||1)-1))];
  return <><SectionTitle eyebrow="CITY OPERATIONS / ROUTE INTELLIGENCE" title="Route optimizer" subtitle="Calculate a shortest path across the road network to support faster response dispatch." action={<Pill tone="mint"><span className="live-dot"/> Network online</Pill>}/><div className="routing-grid"><section className="panel route-controls"><div className="panel-heading"><div><h2>Dispatch planner</h2><p>Shortest-path analysis · Dijkstra</p></div><div className="algorithm-badge"><GitBranch size={15}/> DIJKSTRA</div></div><label className="field-label">START LOCATION<select value={from} onChange={e=>{setFrom(e.target.value);setStep(0)}}>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><div className="route-connector"><span/><span/></div><label className="field-label">DESTINATION<select value={to} onChange={e=>{setTo(e.target.value);setStep(0)}}>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><button className="btn primary full-btn" onClick={()=>{runRoute();setStep(0)}}><Route size={16}/> Calculate optimal route</button><div className="route-info"><div><span>Optimization target</span><strong>Minimum total route weight</strong></div><div><span>Graph model</span><strong>Undirected · Weighted</strong></div><div><span>Edge weights</span><strong>Illustrative travel minutes</strong></div></div>{result&&<div className="route-result"><div className="result-top"><span>OPTIMAL ROUTE</span><Pill tone="mint">Calculated</Pill></div><div className="result-time">{Number.isFinite(result.distance)?`${result.distance} min`:"No route"}<span>estimated network weight</span></div><div className="route-path">{result.path.map((id,i)=><React.Fragment key={id}><span>{locations.find(l=>l.id===id)?.name}</span>{i<result.path.length-1&&<ChevronRight size={13}/>}</React.Fragment>)}</div><div className="result-metrics"><div><span>Stops</span><b>{result.path.length}</b></div><div><span>Visited nodes</span><b>{result.steps.length}</b></div><div><span>Algorithm</span><b>Dijkstra</b></div></div></div>}</section><section className="panel routing-map-panel"><div className="panel-heading"><div><h2>Road network</h2><p>Selected path highlighted in mint</p></div><Pill tone="neutral">{locations.length} nodes · {roadEdges.length} edges</Pill></div><CityMap routePath={result?.path||[]}/>{result&&<div className="trace-panel"><div className="trace-heading"><div><strong>Execution trace</strong><span>Node visits from Dijkstra's algorithm</span></div><span>{Math.min(step+1,result.steps.length)} / {result.steps.length}</span></div><input aria-label="Route algorithm trace step" type="range" min="0" max={Math.max(0,result.steps.length-1)} value={Math.min(step,Math.max(0,result.steps.length-1))} onChange={e=>setStep(Number(e.target.value))}/>{chosenStep&&<div className="trace-current"><span className="trace-index">STEP {step+1}</span><strong>Visit {locations.find(l=>l.id===chosenStep.current)?.name}</strong><span>Current distance: {chosenStep.distance} min</span></div>}</div>}<div className="network-note"><CircleHelp size={15}/><span>This is a demonstration road graph with illustrative weights, not live traffic or GPS data.</span></div></section></div></>;
}

function ComplaintsPage({complaints,query,setQuery,search,setSearch,result,runSearch,onAdd}) {
  return <><SectionTitle eyebrow="CITIZEN SERVICES / REPORT INTELLIGENCE" title="Complaint intelligence" subtitle="Search citizen reports, find similar submissions, and organize service requests." action={<button className="btn primary" onClick={onAdd}><Plus size={16}/> New complaint</button>}/><div className="complaint-search-panel panel"><div className="search-panel-copy"><div className="feature-icon"><ScanSearch size={20}/></div><div><h2>Text pattern search</h2><p>Use Knuth–Morris–Pratt (KMP) string matching to find a phrase in complaint reports without repeatedly rechecking matched characters.</p></div></div><div className="kmp-search-row"><div className="kmp-input"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runSearch()} placeholder="Search phrase, e.g. traffic signal"/></div><button className="btn primary" onClick={runSearch}><Search size={15}/> Find reports</button></div>{result&&<div className="kmp-results"><div className="kmp-summary"><strong>{result.length} matching report{result.length===1?"":"s"}</strong><span>Pattern matching · KMP</span></div>{result.map(r=><div className="kmp-result" key={r.complaint.id}><div className="kmp-result-id">{r.complaint.id}</div><div className="kmp-result-content"><strong>{r.complaint.area} · {r.complaint.category}</strong><p>{highlightMatches(r.complaint.text,search)}</p><span>{r.matches.length} match position{r.matches.length===1?"":"s"} · {r.comparisons} character comparisons</span></div><Pill tone="mint">{r.complaint.status}</Pill></div>)}{result.length===0&&<div className="no-results">No reports matched that exact phrase. Try a shorter pattern.</div>}</div>}</div><section className="panel table-panel"><div className="panel-heading padded-heading"><div><h2>Citizen reports</h2><p>Reports in the current service queue</p></div><div className="toolbar-search"><Search size={15}/><input placeholder="Filter reports…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="table-scroll"><table><thead><tr><th>REPORT</th><th>LOCATION</th><th>CATEGORY</th><th>STATUS</th><th>SUBMITTED</th></tr></thead><tbody>{complaints.map(c=><tr key={c.id}><td><div className="report-title"><strong>{c.id}</strong><span>{c.text}</span></div></td><td><span className="location-cell"><MapPin size={13}/>{c.area}</span></td><td>{c.category}</td><td><Pill tone={c.status==="Assigned"?"blue":c.status==="Duplicate candidate"?"warning":"neutral"}>{c.status}</Pill></td><td className="muted-cell">{c.time}</td></tr>)}</tbody></table>{complaints.length===0&&<div className="empty-state"><Search size={22}/><strong>No reports found</strong><span>Try a different search.</span></div>}</div><div className="table-footer"><span>{complaints.length} report records</span><span>Search is case-insensitive</span></div></section></>;
}
function highlightMatches(text,pattern) {
  if(!pattern.trim()) return text;
  const i=text.toLowerCase().indexOf(pattern.toLowerCase());
  if(i<0) return text;
  return <>{text.slice(0,i)}<mark>{text.slice(i,i+pattern.length)}</mark>{text.slice(i+pattern.length)}</>;
}

function InfrastructurePage({networkReport}) {
  const [filter,setFilter] = useState("All");
  const [selected,setSelected] = useState(null);
  const spanningTree = useMemo(() => kruskalMST(locations, roadEdges.map(([from,to,weight]) => ({from,to,weight}))), []);
  const assets = [
    {id:"AST-101",name:"Central traffic signals",type:"Traffic control",area:"Central Avenue",health:"Attention",metric:"1 fault reported",icon:Zap},
    {id:"AST-102",name:"Lakeview water main",type:"Water network",area:"Lakeview District",health:"Warning",metric:"Pressure anomaly",icon:Waves},
    {id:"AST-103",name:"North Park lighting",type:"Power / lighting",area:"North Park",health:"Attention",metric:"3 fixtures offline",icon:Zap},
    {id:"AST-104",name:"City road network",type:"Transport",area:"Metro District",health:"Operational",metric:`${roadEdges.length} connected segments`,icon:Network},
    {id:"AST-105",name:"Emergency response depot",type:"Public safety",area:"East Quarter",health:"Operational",metric:"Dispatch ready",icon:ShieldAlert},
    {id:"AST-106",name:"Civic service centre",type:"Municipal services",area:"Civic Centre",health:"Operational",metric:"All services online",icon:RadioTower}
  ];
  const visible=assets.filter(a=>(filter==="All"||a.health===filter));
  return <><SectionTitle eyebrow="CITY SYSTEMS / ASSET MONITORING" title="Infrastructure network" subtitle="Review connected city assets, operational health, and network connectivity." action={<Pill tone={networkReport.connected?"mint":"warning"}><span className="live-dot"/>{networkReport.connected?"Network connected":"Connectivity issue"}</Pill>}/><div className="metrics-grid compact-metrics"><MetricCard label="Tracked assets" value={assets.length} change="Demo inventory" caption="city systems" icon={Layers3} tone="blue"/><MetricCard label="Need attention" value={assets.filter(a=>a.health==="Attention"||a.health==="Warning").length} change="Action suggested" caption="reported anomalies" icon={AlertTriangle} tone="coral"/><MetricCard label="Connected components" value={networkReport.components.length} change="BFS analysis" caption="network graph" icon={GitBranch} tone="mint"/></div><div className="infrastructure-grid"><section className="panel"><div className="panel-heading"><div><h2>City connectivity graph</h2><p>Breadth-first search connectivity analysis</p></div><Pill tone="neutral">{locations.length} nodes</Pill></div><CityMap/><div className="network-summary"><div><span>Graph status</span><strong>{networkReport.connected?"Connected":"Multiple components"}</strong></div><div><span>Connected components</span><strong>{networkReport.components.length}</strong></div><div><span>Adjacency structure</span><strong>Undirected graph</strong></div></div></section><section className="panel asset-panel"><div className="panel-heading"><div><h2>Infrastructure assets</h2><p>Illustrative operational inventory</p></div><select className="compact-select" value={filter} onChange={e=>setFilter(e.target.value)}>{["All","Operational","Warning","Attention"].map(f=><option key={f}>{f}</option>)}</select></div><div className="asset-list">{visible.map(a=><button key={a.id} className={`asset-item ${selected===a.id?"chosen":""}`} onClick={()=>setSelected(selected===a.id?null:a.id)}><div className={`asset-icon ${a.health==="Operational"?"mint":a.health==="Warning"?"warning":"coral"}`}><a.icon size={17}/></div><div className="asset-copy"><strong>{a.name}</strong><span>{a.area} · {a.id}</span><small>{a.metric}</small>{selected===a.id&&<em>{a.type}. Sample status is illustrative; connect a real sensor or service feed for live monitoring.</em>}</div><Pill tone={a.health==="Operational"?"mint":a.health==="Warning"?"warning":"coral"}>{a.health}</Pill></button>)}</div></section><section className="panel asset-panel mst-panel"><div className="panel-heading"><div><h2>Minimum-cost infrastructure plan</h2><p>Kruskal's minimum spanning tree</p></div><Pill tone="mint">{spanningTree.connected ? "Connected" : "Disconnected"}</Pill></div><div className="network-summary"><div><span>Selected links</span><strong>{spanningTree.edges.length}</strong></div><div><span>Total edge weight</span><strong>{spanningTree.totalWeight}</strong></div><div><span>Complexity</span><strong>O(E log E)</strong></div></div><p className="mst-explanation">This plan selects the lowest-weight road links needed to connect all modeled locations without cycles. Weights are illustrative; this is a network-design view, not a shortest-route result.</p><div className="mst-edge-list">{spanningTree.edges.map((edge,i)=><div key={`${edge.from}-${edge.to}`} className="mst-edge-row"><span className="mst-edge-number">{String(i+1).padStart(2,"0")}</span><span>{locations.find(l=>l.id===edge.from)?.name} <ArrowRight size={13}/> {locations.find(l=>l.id===edge.to)?.name}</span><strong>{edge.weight}</strong></div>)}</div></section></div></>;
}

function ResourcesPage({incidents,units,setUnits,result,run}) {
  const assigned=result?.filter(r=>r.assigned).length||0;
  return <><SectionTitle eyebrow="CITY OPERATIONS / RESPONSE PLANNING" title="Resource allocation" subtitle="Create a transparent dispatch proposal by ranking unresolved incidents by severity." action={<Pill tone="neutral"><Layers3 size={13}/> Greedy priority heuristic</Pill>}/><div className="resource-grid"><section className="panel resource-controls"><div className="panel-heading"><div><h2>Available response units</h2><p>Set the number of teams available for this planning run.</p></div></div><div className="unit-number">{units}<span>units</span></div><input className="unit-slider" type="range" min="1" max="12" value={units} onChange={e=>setUnits(Number(e.target.value))}/><div className="slider-labels"><span>1 unit</span><span>12 units</span></div><div className="allocation-rule"><div className="rule-icon"><Sparkles size={17}/></div><div><strong>Allocation rule</strong><p>Critical incidents require 2 units; other unresolved incidents require 1. Incidents are considered in severity order.</p></div></div><button className="btn primary full-btn" onClick={run}><Layers3 size={16}/> Generate allocation plan</button><div className="disclaimer"><CircleHelp size={15}/><span>This is a greedy planning heuristic for demonstration. It is not an operational dispatch recommendation and does not consider real travel times, staff qualifications, or resource constraints.</span></div></section><section className="panel allocation-results"><div className="panel-heading"><div><h2>Allocation proposal</h2><p>Based on current unresolved incidents</p></div>{result&&<Pill tone="mint">Plan generated</Pill>}</div>{!result?<div className="empty-state tall"><Layers3 size={25}/><strong>No plan generated yet</strong><span>Choose available units, then generate a proposal.</span></div>:<><div className="allocation-summary"><div><span>Incidents covered</span><strong>{assigned} / {result.length}</strong></div><div><span>Units remaining</span><strong>{result.reduce((n,r)=>n+(r.assigned?r.unitsNeeded:0),0)} used</strong></div></div><div className="allocation-list">{result.map((r,i)=><div className="allocation-item" key={r.id}><div className={`allocation-rank ${r.assigned?"mint":"coral"}`}>{String(i+1).padStart(2,"0")}</div><div className="allocation-copy"><strong>{r.title}</strong><span>{r.area} · {r.severity} priority</span></div><div className="allocation-status">{r.assigned?<Pill tone="mint"><Check size={12}/> Proposed</Pill>:<Pill tone="coral">Insufficient units</Pill>}<small>{r.assigned?`${r.unitsNeeded} unit${r.unitsNeeded>1?"s":""}`:"No assignment"}</small></div></div>)}</div></>}</section></div></>;
}

function Modal({title,subtitle,onClose,children}) {
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><IconButton title="Close" onClick={onClose}><X size={17}/></IconButton></div>{children}</div></div>;
}

export default App;