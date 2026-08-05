import sys
import os
import yaml
import subprocess
import json

def run_verification():
    results = {}
    yaml_path = os.path.join(os.getcwd(), '.github', 'workflows', 'deploy.yml')
    
    # 1. YAML parsing programmatically
    try:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            content = f.read()
        parsed_yaml = yaml.safe_load(content)
        results['yaml_parsing'] = {'status': 'PASS', 'details': 'Successfully parsed YAML syntax.'}
    except Exception as e:
        results['yaml_parsing'] = {'status': 'FAIL', 'details': f'YAML parse error: {str(e)}'}
        print(json.dumps(results, indent=2))
        return

    # 2. Indentation check
    indentation_issues = []
    lines = content.splitlines()
    for idx, line in enumerate(lines, 1):
        if '\t' in line:
            indentation_issues.append(f'Line {idx} contains tabs')
        # Check step indentation consistency if step starts with - name:
        if line.strip().startswith('- name:'):
            leading_spaces = len(line) - len(line.lstrip(' '))
            if leading_spaces != 6:
                indentation_issues.append(f'Line {idx} step indentation is {leading_spaces} spaces, expected 6')
    
    if indentation_issues:
        results['indentation'] = {'status': 'FAIL', 'details': indentation_issues}
    else:
        results['indentation'] = {'status': 'PASS', 'details': 'No tab characters found; step indentation consistent at 6 spaces.'}

    # 3. Step positioning relative to Terraform Init
    deploy_job = parsed_yaml.get('jobs', {}).get('deploy', {})
    steps = deploy_job.get('steps', [])
    
    aws_cred_idx = -1
    tf_init_idx = -1
    aws_cred_step = None
    
    for idx, step in enumerate(steps):
        name = step.get('name', '')
        if name == 'Configure AWS credentials':
            aws_cred_idx = idx
            aws_cred_step = step
        elif name == 'Terraform Init':
            tf_init_idx = idx
            
    if aws_cred_idx == -1:
        results['step_positioning'] = {'status': 'FAIL', 'details': 'Configure AWS credentials step not found'}
    elif tf_init_idx == -1:
        results['step_positioning'] = {'status': 'FAIL', 'details': 'Terraform Init step not found'}
    elif aws_cred_idx < tf_init_idx:
        results['step_positioning'] = {
            'status': 'PASS',
            'details': f'Configure AWS credentials (index {aws_cred_idx}) is positioned before Terraform Init (index {tf_init_idx})'
        }
    else:
        results['step_positioning'] = {
            'status': 'FAIL',
            'details': f'Configure AWS credentials (index {aws_cred_idx}) is NOT before Terraform Init (index {tf_init_idx})'
        }

    # 4. Action version check
    if aws_cred_step:
        uses = aws_cred_step.get('uses', '')
        if uses == 'aws-actions/configure-aws-credentials@v2':
            results['action_version'] = {'status': 'PASS', 'details': f'Uses exact action version: {uses}'}
        else:
            results['action_version'] = {'status': 'FAIL', 'details': f'Expected aws-actions/configure-aws-credentials@v2, got {uses}'}
    else:
        results['action_version'] = {'status': 'FAIL', 'details': 'Step missing'}

    # 5. Secret name formatting check
    if aws_cred_step:
        step_with = aws_cred_step.get('with', {})
        key_id = step_with.get('aws-access-key-id', '')
        secret_key = step_with.get('aws-secret-access-key', '')
        
        job_env = deploy_job.get('env', {})
        env_key_id = job_env.get('AWS_ACCESS_KEY_ID', '')
        env_secret_key = job_env.get('AWS_SECRET_ACCESS_KEY', '')
        
        secret_checks = []
        if key_id == '${{ secrets.AWS_ACCESS_KEY_ID }}':
            secret_checks.append('Step aws-access-key-id correctly references secrets.AWS_ACCESS_KEY_ID')
        else:
            secret_checks.append(f'Step aws-access-key-id expected ${{ secrets.AWS_ACCESS_KEY_ID }}, got {key_id}')
            
        if secret_key == '${{ secrets.AWS_SECRET_ACCESS_KEY }}':
            secret_checks.append('Step aws-secret-access-key correctly references secrets.AWS_SECRET_ACCESS_KEY')
        else:
            secret_checks.append(f'Step aws-secret-access-key expected ${{ secrets.AWS_SECRET_ACCESS_KEY }}, got {secret_key}')

        if env_key_id == '${{ secrets.AWS_ACCESS_KEY_ID }}':
            secret_checks.append('Job env AWS_ACCESS_KEY_ID correctly references secrets.AWS_ACCESS_KEY_ID')
        else:
            secret_checks.append(f'Job env AWS_ACCESS_KEY_ID expected ${{ secrets.AWS_ACCESS_KEY_ID }}, got {env_key_id}')

        if env_secret_key == '${{ secrets.AWS_SECRET_ACCESS_KEY }}':
            secret_checks.append('Job env AWS_SECRET_ACCESS_KEY correctly references secrets.AWS_SECRET_ACCESS_KEY')
        else:
            secret_checks.append(f'Job env AWS_SECRET_ACCESS_KEY expected ${{ secrets.AWS_SECRET_ACCESS_KEY }}, got {env_secret_key}')

        has_fail = any('expected' in c for c in secret_checks)
        results['secret_name_formatting'] = {
            'status': 'FAIL' if has_fail else 'PASS',
            'details': secret_checks
        }
    else:
        results['secret_name_formatting'] = {'status': 'FAIL', 'details': 'Step missing'}

    # 6. Git commit message formatting check
    try:
        cmd_res = subprocess.run(['git', 'log', '-1', '--pretty=%B'], capture_output=True, text=True, check=True)
        commit_msg = cmd_res.stdout.strip()
        expected_msg = 'fix(ci): configure aws credentials for terraform deploy'
        
        # Check current branch
        branch_res = subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], capture_output=True, text=True, check=True)
        current_branch = branch_res.stdout.strip()
        
        if commit_msg == expected_msg:
            results['commit_message_formatting'] = {
                'status': 'PASS',
                'details': f'Commit message on branch "{current_branch}" matches exact expected message: "{commit_msg}"'
            }
        else:
            results['commit_message_formatting'] = {
                'status': 'FAIL',
                'details': f'Expected "{expected_msg}", got "{commit_msg}" on branch "{current_branch}"'
            }
    except Exception as e:
        results['commit_message_formatting'] = {'status': 'FAIL', 'details': f'Git command error: {str(e)}'}

    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    run_verification()
