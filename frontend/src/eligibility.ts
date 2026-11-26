export type StudentProfile=Record<string,unknown>;
export type Rule={
 field_name?:string;criterion_type?:string;operator:string;expected_value?:unknown;criterion_value?:unknown;
 is_required?:boolean;is_mandatory?:boolean;condition_group?:string;condition_operator?:'AND'|'OR';group_operator?:'AND'|'OR';
 academic_year?:string|null;source_url?:string|null;source_note?:string|null;verification_status?:string;last_verified_at?:string|null;
};
export type CriterionResult={field:string;status:'matched'|'not_met'|'unknown'|'optional';expected:unknown;actual:unknown;sourceNote?:string|null;sourceUrl?:string|null;verificationStatus:string;academicYear?:string|null;conditionGroup:string;conditionOperator:'AND'|'OR'};
export type EligibilityResult={status:'eligible'|'not_eligible'|'needs_information';matched:number;failed:string[];unknown:string[]};
export type DetailedEligibilityResult=EligibilityResult&{criteria:CriterionResult[]};

const get=(o:StudentProfile,k:string):unknown=>{
 const aliases:Record<string,string>={minimum_age:'age',maximum_age:'age',domicile_state:'region_name',category:'social_category',minority:'minority_community',minimum_percentage:'percentage',fresh_or_renewal:'application_type',other_scholarship_status:'current_scholarship',receiving_other_scholarship:'current_scholarship',backlog_status:'has_backlogs',income_certificate_availability:'income_certificate_available',institution_recognition:'institution_recognized'};
 const field=aliases[k]||k;
 if(k==='regular_course'&&o.study_mode)return String(o.study_mode).toLowerCase()==='regular';
 if(k==='parent_occupation')return[o.father_occupation,o.mother_occupation].filter(Boolean);
 if(field==='age'&&o.date_of_birth){const dob=new Date(String(o.date_of_birth));if(Number.isNaN(dob.getTime()))return undefined;const today=new Date();let age=today.getFullYear()-dob.getFullYear();if(today.getMonth()<dob.getMonth()||(today.getMonth()===dob.getMonth()&&today.getDate()<dob.getDate()))age--;return age}
 return field.split('.').reduce<unknown>((v,key)=>v&&typeof v==='object'?(v as Record<string,unknown>)[key]:undefined,o);
};
const normalized=(v:unknown)=>typeof v==='string'?v.trim().toLocaleLowerCase():v;
function compare(actual:unknown,operator:string,expected:unknown):boolean|undefined{
 if(actual===undefined||actual===null||actual==='')return undefined;
 const a=normalized(actual),e=normalized(expected);
 switch(operator.toLowerCase()){
  case'eq':case'equals':return Array.isArray(actual)?actual.some(x=>normalized(x)===e):a===e;
  case'neq':case'not_equals':return Array.isArray(actual)?!actual.some(x=>normalized(x)===e):a!==e;
  case'gt':return Number(actual)>Number(expected);
  case'gte':case'min':return Number(actual)>=Number(expected);
  case'lt':return Number(actual)<Number(expected);
  case'lte':case'max':return Number(actual)<=Number(expected);
  case'in':case'one_of':return Array.isArray(expected)&&(Array.isArray(actual)?actual.some(v=>expected.some(x=>normalized(x)===normalized(v))):expected.some(x=>normalized(x)===a));
  case'not_in':return Array.isArray(expected)&&!expected.some(x=>normalized(x)===a);
  case'contains':return Array.isArray(actual)?actual.some(x=>normalized(x)===e):typeof actual==='string'&&actual.toLocaleLowerCase().includes(String(expected).toLocaleLowerCase());
  case'truthy':case'is_true':return Boolean(actual)===Boolean(expected);
  case'between':return Array.isArray(expected)&&expected.length===2&&Number(actual)>=Number(expected[0])&&Number(actual)<=Number(expected[1]);
  default:return undefined;
 }
}
function combine(values:(boolean|undefined)[],operator:'AND'|'OR'):boolean|undefined{
 if(operator==='OR'){if(values.includes(true))return true;if(values.every(v=>v===false))return false;return undefined}
 if(values.includes(false))return false;if(values.every(v=>v===true))return true;return undefined;
}
export function evaluateEligibilityDetailed(profile:StudentProfile,rules:Rule[],academicYear?:string):DetailedEligibilityResult{
 const required=rules.filter(r=>(r.is_mandatory??r.is_required??true));
 if(required.length===0)return{status:'needs_information',matched:0,failed:[],unknown:['eligibility rules'],criteria:[{field:'eligibility rules',status:'unknown',expected:null,actual:null,sourceNote:'Eligibility criteria are not recorded for this scheme.',verificationStatus:'needs_verification',conditionGroup:'default',conditionOperator:'AND'}]};
 const criteria:CriterionResult[]=rules.map(r=>{
  const field=r.criterion_type||r.field_name||'unknown criterion',expected=r.criterion_value!==undefined?r.criterion_value:r.expected_value;
  const mandatory=r.is_mandatory??r.is_required??true,verification=r.verification_status||'verified';
  const conditionGroup=r.condition_group||'default',conditionOperator=r.condition_operator||'AND';
  if(!mandatory)return{field,status:'optional',expected,actual:get(profile,field),sourceNote:r.source_note,sourceUrl:r.source_url,verificationStatus:verification,academicYear:r.academic_year,conditionGroup,conditionOperator};
  if(r.academic_year&&r.academic_year!==academicYear)return{field,status:'unknown',expected,actual:get(profile,field),sourceNote:`Rule is for ${r.academic_year}; selected year is ${academicYear||'not selected'}.`,sourceUrl:r.source_url,verificationStatus:verification,academicYear:r.academic_year,conditionGroup,conditionOperator};
  if(!['verified','confirmed'].includes(verification)||(r.verification_status!==undefined&&!r.source_url))return{field,status:'unknown',expected,actual:get(profile,field),sourceNote:r.source_note||'This condition needs an official source and verification.',sourceUrl:r.source_url,verificationStatus:verification,academicYear:r.academic_year,conditionGroup,conditionOperator};
  const actual=get(profile,field),matched=compare(actual,r.operator,expected);
  return{field,status:matched===true?'matched':matched===false?'not_met':'unknown',expected,actual,sourceNote:r.source_note,sourceUrl:r.source_url,verificationStatus:verification,academicYear:r.academic_year,conditionGroup,conditionOperator};
 });
 const requiredCriteria=criteria.filter(c=>c.status!=='optional');
 const groups=new Map<string,CriterionResult[]>();
 requiredCriteria.forEach(c=>groups.set(c.conditionGroup,[...(groups.get(c.conditionGroup)||[]),c]));
 const groupValues:(boolean|undefined)[]=Array.from(groups.values()).map(group=>combine(group.map(c=>c.status==='matched'?true:c.status==='not_met'?false:undefined),group[0]?.conditionOperator||'AND'));
 // All groups are conjunctive by default. A rule can explicitly make groups alternatives.
 const groupLogic=(required.find(r=>r.group_operator)?.group_operator||'AND') as 'AND'|'OR';
 const overall=combine(groupValues,groupLogic);
 const matched=requiredCriteria.filter(c=>c.status==='matched').length;
 const failed=overall===false?requiredCriteria.filter(c=>c.status==='not_met').map(c=>c.field):[];
 const unknown=overall===undefined?requiredCriteria.filter(c=>c.status==='unknown').map(c=>c.field):[];
 return{status:overall===true?'eligible':overall===false?'not_eligible':'needs_information',matched,failed,unknown,criteria};
}
export function evaluateEligibility(profile:StudentProfile,rules:Rule[],academicYear?:string):EligibilityResult{
 const {status,matched,failed,unknown}=evaluateEligibilityDetailed(profile,rules,academicYear);
 return{status,matched,failed,unknown};
}
