import {z} from 'zod';

const eligibilityFields=[
 'domicile_state','minimum_age','maximum_age','gender','family_income','category','minority','education_level','course','academic_year','minimum_percentage','institution_type','admission_mode','study_mode','disability_percentage','parent_occupation','fresh_or_renewal','backlog_status','other_scholarship_status','income_certificate_availability','state_category','single_girl_child','orphan','single_parent','defence_family','hostel_resident','first_generation','institution_state','admission_type','social_categories','region_name','age','income_certificate_available','disability','percentage','residence_type','residence_mode','previous_scholarship'
] as const;
const eligibilityRule=z.object({
 field_name:z.string().trim().min(2).max(120).optional(),criterion_type:z.enum(eligibilityFields).optional(),
 operator:z.enum(['eq','neq','gt','gte','lt','lte','in','not_in','one_of','contains','truthy','between']),
 expected_value:z.unknown().optional(),criterion_value:z.unknown().optional(),
 is_required:z.boolean().optional(),is_mandatory:z.boolean().optional(),
 condition_group:z.string().trim().min(1).max(80).optional(),condition_operator:z.enum(['AND','OR']).optional(),group_operator:z.enum(['AND','OR']).optional(),
 academic_year:z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
 source_url:z.string().url().refine(x=>x.startsWith('https://'),'Rule sources must use HTTPS').optional().nullable(),
 verification_status:z.enum(['needs_verification','verified','outdated']).optional(),last_verified_at:z.string().datetime().optional().nullable(),
 source_note:z.string().max(500).optional().nullable()
}).refine(x=>x.field_name||x.criterion_type,'A criterion type is required').refine(x=>x.expected_value!==undefined||x.criterion_value!==undefined,'A criterion value is required').transform(r=>({
 ...r,field_name:r.field_name||r.criterion_type!,criterion_type:r.criterion_type||r.field_name!,
 expected_value:r.expected_value!==undefined?r.expected_value:r.criterion_value,
 criterion_value:r.criterion_value!==undefined?r.criterion_value:r.expected_value,
 is_required:r.is_required??r.is_mandatory??true,is_mandatory:r.is_mandatory??r.is_required??true,
 condition_group:r.condition_group||'default',condition_operator:r.condition_operator||'AND',group_operator:r.group_operator||'AND',
 verification_status:r.verification_status||'needs_verification'
}));
const schemeDocument=z.object({document_name:z.string().trim().min(2).max(200),requirement_type:z.enum(['required','optional','conditional']),format_requirements:z.string().max(500).optional().nullable(),validity_requirements:z.string().max(500).optional().nullable(),condition_text:z.string().max(500).optional().nullable(),source_note:z.string().max(500).optional().nullable()});
export const importedSchemeSchema=z.object({
 name:z.string().trim().min(2).max(300),summary:z.string().max(5000).optional().nullable(),description:z.string().max(30000).optional().nullable(),category:z.string().max(120).optional().nullable(),government_level:z.enum(['central','state','ut','private']),state_name:z.string().max(120).optional().nullable(),department:z.string().max(200).optional().nullable(),academic_year:z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),target_categories:z.array(z.string().max(80)).optional(),education_levels:z.array(z.string().max(100)).optional(),eligible_courses:z.array(z.string().max(150)).optional(),min_age:z.number().int().min(0).max(120).optional().nullable(),max_age:z.number().int().min(0).max(120).optional().nullable(),annual_income_limit:z.number().nonnegative().optional().nullable(),min_percentage:z.number().min(0).max(100).optional().nullable(),gender_requirements:z.string().max(300).optional().nullable(),caste_requirements:z.string().max(300).optional().nullable(),disability_requirement:z.string().max(500).optional().nullable(),institution_requirements:z.string().max(1000).optional().nullable(),other_conditions:z.string().max(10000).optional().nullable(),amount_min:z.number().nonnegative().optional().nullable(),amount_max:z.number().nonnegative().optional().nullable(),benefits:z.string().max(5000).optional().nullable(),application_start:z.string().date().optional().nullable(),application_end:z.string().date().optional().nullable(),application_status:z.enum(['open','upcoming','closed','unknown']).optional(),required_documents:z.array(z.string().max(200)).optional(),application_procedure:z.string().max(5000).optional().nullable(),renewal_conditions:z.string().max(5000).optional().nullable(),official_url:z.string().url().refine(x=>x.startsWith('https://'),'Official links must use HTTPS').optional().nullable(),external_identifier:z.string().max(200).optional().nullable(),eligibility_rules:z.array(eligibilityRule).max(100).optional(),documents:z.array(schemeDocument).max(100).optional()
}).refine(x=>x.min_age==null||x.max_age==null||x.min_age<=x.max_age,'Minimum age cannot exceed maximum age').refine(x=>x.amount_min==null||x.amount_max==null||x.amount_min<=x.amount_max,'Minimum benefit cannot exceed maximum benefit');
export function normalizedDuplicateKey(x:{name:string;government_level:string;state_name?:string|null;official_url?:string|null;external_identifier?:string|null}){if(x.external_identifier)return `id:${x.government_level}:${x.state_name||''}:${x.external_identifier.toLowerCase()}`;if(x.official_url)return `url:${x.official_url.toLowerCase().replace(/\/$/,'')}`;return `name:${x.government_level}:${(x.state_name||'').toLowerCase()}:${x.name.trim().toLowerCase().replace(/\s+/g,' ')}`}
